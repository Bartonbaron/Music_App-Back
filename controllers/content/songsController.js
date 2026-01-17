const { S3Client, PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const mm = require("music-metadata");
const {Op} = require("sequelize");

const { sequelize, models } = require("../../models");
const Song = models.songs;
const CreatorProfile = models.creatorprofiles;
const User = models.users;
const Album = models.albums;
const Genre = models.genres;
const UserSongLikes = models.usersonglikes;
const FavoriteSongs = models.favoritesongs;
const StreamHistory = models.streamhistory;

const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey");

require("dotenv").config();

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);

const getReqUserID = (req) => Number(req.user?.userID ?? req.user?.id);
const isAdminReq = (req) => Number(req.user?.roleID) === ADMIN_ROLE_ID;

const canSeeHiddenSong = async (song, req) => {
    if (!song) return false;

    // admin zawsze
    if (isAdminReq(req)) return true;

    // owner (twórca utworu)
    // 1) jeśli token ma creatorID
    const tokenCreatorID = Number(req.user?.creatorID);
    if (Number.isFinite(tokenCreatorID) && tokenCreatorID > 0) {
        return tokenCreatorID === Number(song.creatorID);
    }

    // 2) fallback: po userID -> creatorProfile
    const userID = getReqUserID(req);
    if (!Number.isFinite(userID) || userID <= 0) return false;

    const creator = await CreatorProfile.findOne({
        where: { userID, isActive: true },
        attributes: ["creatorID"],
    });

    if (!creator) return false;
    return Number(creator.creatorID) === Number(song.creatorID);
};

// Pojedynczy utwór
const getSong = async (req, res) => {
    try {
        const songID = Number(req.params.songID);
        if (!Number.isFinite(songID) || songID <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe ID utworu" });
        }

        const song = await Song.findByPk(songID, {
            include: [
                {
                    model: CreatorProfile,
                    as: "creator",
                    required: false,
                    attributes: ["creatorID", "userID", "isActive"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            required: false,
                            attributes: ["userID", "userName", "profilePicURL"],
                        },
                    ],
                },
                { model: Album, as: "album", required: false },
            ],
        });

        if (!song) {
            return res.status(404).json({ message: "Nie znaleziono utworu" });
        }

        const privileged = await canSeeHiddenSong(song, req);

        // jeśli utwór ukryty -> tylko admin/właściciel
        if (song.moderationStatus !== "ACTIVE" && !privileged) {
            return res.status(403).json({ message: "Ten utwór jest niedostępny" });
        }

        const audioKey = song.fileURL ? extractKey(song.fileURL) : null;
        const coverKey = song.coverURL ? extractKey(song.coverURL) : null;

        const albumCoverKey = song.album?.coverURL ? extractKey(song.album.coverURL) : null;
        const creatorAvatarKey = song.creator?.user?.profilePicURL
            ? extractKey(song.creator.user.profilePicURL)
            : null;

        const isHidden = song.moderationStatus !== "ACTIVE";
        const canStream = privileged ? true : !isHidden;

        return res.json({
            songID: song.songID,
            songName: song.songName,
            description: song.description ?? "",
            duration: song.duration,

            creatorID: song.creator?.creatorID ?? null,
            creatorName: song.creator?.user?.userName ?? null,
            signedProfilePicURL: creatorAvatarKey ? await generateSignedUrl(creatorAvatarKey) : null,

            signedAudio: canStream && audioKey ? await generateSignedUrl(audioKey) : null,
            signedCover: coverKey ? await generateSignedUrl(coverKey) : null,

            album: song.album
                ? {
                    albumID: song.album.albumID,
                    albumName: song.album.albumName,
                    signedCover: albumCoverKey ? await generateSignedUrl(albumCoverKey) : null,
                }
                : null,
        });
    } catch (err) {
        console.error("GET SONG ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// Lista utworów
const getSongsList = async (req, res) => {
    try {
        const songs = await Song.findAll({
            where: { moderationStatus: "ACTIVE" },
            include: [
                {
                    model: CreatorProfile,
                    as: "creator",
                    attributes: ["creatorID"],
                    include: [{ model: User, as: "user", attributes: ["userID", "userName"] }],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        const result = await Promise.all(
            songs.map(async (song) => {
                const audioKey = song.fileURL ? extractKey(song.fileURL) : null;
                const coverKey = song.coverURL ? extractKey(song.coverURL) : null;

                return {
                    songID: song.songID,
                    songName: song.songName,
                    creatorID: song.creatorID,
                    creatorName: song.creator?.user?.userName ?? null,
                    duration: song.duration,
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        return res.json(result);
    } catch (err) {
        console.error("GET SONGS LIST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const getMySongs = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID, isActive: true },
            attributes: ["creatorID"],
        });

        if (!creator) return res.status(403).json({ message: "Nie znaleziono profilu twórcy" });

        const where = { creatorID: creator.creatorID };

        if (String(req.query.unassigned) === "1") {
            where.albumID = null;
        }

        const songs = await Song.findAll({
            where,
            include: [{ model: Genre, as: "genre", required: false }],
            order: [["createdAt", "DESC"]],
        });

        const presented = await Promise.all(
            songs.map(async (s) => {
                const coverKey = s.coverURL ? extractKey(s.coverURL) : null;
                const audioKey = s.fileURL ? extractKey(s.fileURL) : null;

                return {
                    ...s.toJSON(),
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                };
            })
        );

        return res.json({ songs: presented });
    } catch (err) {
        console.error("GET MY SONGS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// Upload utworu
const uploadSong = async (req, res) => {
    try {
        const audioFile = req.files?.file?.[0];
        const coverFile = req.files?.cover?.[0];
        const { genreID, description } = req.body;

        if (!audioFile) {
            return res.status(400).json({ message: "Plik audio jest wymagany" });
        }

        if (!genreID) {
            return res.status(400).json({ message: "Pole genreID jest wymagane" });
        }

        // sprawdzenie, czy gatunek istnieje
        const genre = await models.genres.findByPk(genreID);
        if (!genre) {
            return res.status(400).json({ message: "Nieprawidłowy genreID" });
        }

        // Duration
        let duration = 0;
        try {
            const metadata = await mm.parseBuffer(audioFile.buffer);
            duration = Math.round(metadata.format.duration);
        } catch (err) {
            console.warn("Metadata error:", err);
        }

        if (!duration) return res.status(400).json({ message: "Nieprawidłowe metadane pliku audio" });

        const songName = audioFile.originalname.replace(/\.[^/.]+$/, "");

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id, isActive: true }
        });

        if (!creator) {
            return res.status(403).json({ message: "Nie znaleziono profilu twórcy" });
        }

        // Opis (opcjonalnie)
        const desc = String(description ?? "").trim();
        if (desc.length > 2000) {
           return res.status(400).json({ message: "Opis jest za długi (maks. 2000 znaków)" });
        }

        // Stwórz najpierw rekord w bazie
        const song = await Song.create({
            songName,
            description: desc || null,
            creatorID: creator.creatorID,
            duration,
            fileURL: null,
            coverURL: null,
            streamCount: 0,
            likeCount: 0,
            genreID
        });

        const songID = song.songID;

        // Upload audio do S3
        const audioKey = `audio/songs/${songID}.mp3`;

        await s3.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: audioKey,
            Body: audioFile.buffer,
            ContentType: audioFile.mimetype
        }));

        const audioURL =
            `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${audioKey}`;

        // Upload cover
        let coverURL = null;
        if (coverFile) {
            const extRaw = String(coverFile.originalname || "").split(".").pop();
            const ext = extRaw && extRaw.length <= 6 ? extRaw : "jpg";
            const coverKey = `covers/songs/${songID}.${ext}`;

            await s3.send(new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: coverKey,
                Body: coverFile.buffer,
                ContentType: coverFile.mimetype
            }));

            coverURL =
                `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${coverKey}`;
        }

        await song.update({ fileURL: audioURL, coverURL: coverURL });

        return res.status(201).json({
            message: "Utwór został dodany!",
            song,
            audioURL,
            coverURL
        });

    } catch (err) {
        console.log("UPLOAD ERROR:", err);
        return res.status(500).json({ message: "Nie udało się dodać utworu", error: err });
    }
};

const updateSong = async (req, res) => {
    try {
        const { songID } = req.params;
        const { songName, genreID, description } = req.body;
        const coverFile = req.file || null;

        if (!songID) {
            return res.status(400).json({ message: "Pole songID jest wymagane" });
        }

        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Nie znaleziono utworu" });
        }

        // sprawdź twórcę
        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id, isActive: true },
            attributes: ["creatorID", "userID"],
        });

        if (!creator) {
            return res.status(403).json({ message: "Nie znaleziono profilu twórcy" });
        }

        if (String(song.creatorID) !== String(creator.creatorID)) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        // aktualizacja nazwy
        if (songName !== undefined) {
            const trimmed = String(songName).trim();
            if (!trimmed) {
                return res.status(400).json({ message: "Nazwa utworu nie może być pusta" });
            }
            song.songName = trimmed;
        }

        // Update gatunku
        if (genreID !== undefined) {
            const gid = Number(genreID);
            if (!Number.isFinite(gid) || gid <= 0) {
                return res.status(400).json({ message: "Nieprawidłowy genreID" });
            }

            const genre = await Genre.findByPk(gid);
            if (!genre) {
                return res.status(400).json({ message: "Nieprawidłowy genreID" });
            }

            song.genreID = gid;
        }

        if (description !== undefined) {
            const desc = String(description ?? "").trim();

            // limit jak w UI
            if (desc.length > 2000) {
                return res.status(400).json({ message: "Opis jest za długi (maks. 2000 znaków)" });
            }

            song.description = desc || null;
        }

        // Upload okładki
        if (coverFile) {
            const oldCoverKey = extractKey(song.coverURL);

            const ext = coverFile.originalname.split(".").pop();
            const coverKey = `covers/songs/${song.songID}.${ext}`;

            await s3.send(
                new PutObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: coverKey,
                    Body: coverFile.buffer,
                    ContentType: coverFile.mimetype,
                })
            );

            song.coverURL = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${coverKey}`;

            if (oldCoverKey && oldCoverKey !== coverKey) {
                try {
                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: process.env.AWS_S3_BUCKET,
                            Key: oldCoverKey,
                        })
                    );
                } catch (e) {
                    console.warn("DELETE OLD COVER WARN:", e?.message || e);
                }
            }
        }

        await song.save();

        const coverKey = extractKey(song.coverURL);
        const signedCover = coverKey ? await generateSignedUrl(coverKey) : null;

        return res.json({
            message: "Zaktualizowano utwór",
            song: {
                songID: song.songID,
                songName: song.songName,
                genreID: song.genreID,
                creatorID: song.creatorID,
                duration: song.duration,
                description: song.description,
                signedCover,
            },
        });
    } catch (err) {
        console.error("UPDATE SONG ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// Usuwanie utworu
const deleteSong = async (req, res) => {
    try {
        const { songID } = req.params;

        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Nie znaleziono utworu" });
        }

        const extractKey = (url) =>
            url ? url.split(".amazonaws.com/")[1] : null;

        const audioKey = extractKey(song.fileURL);
        const coverKey = extractKey(song.coverURL);

        const objectsToDelete = [];
        if (audioKey) objectsToDelete.push({ Key: audioKey });
        if (coverKey) objectsToDelete.push({ Key: coverKey });

        if (objectsToDelete.length > 0) {
            const cmd = new DeleteObjectsCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Delete: { Objects: objectsToDelete }
            });
            await s3.send(cmd);
        }

        await song.destroy();

        return res.json({
            message: "Usunięto utwór",
            deletedFiles: objectsToDelete.map(x => x.Key),
            autoIncrementReset: count === 0
        });

    } catch (err) {
        console.log("DELETE ERROR:", err);
        return res.status(500).json({ message: "Nie udało się usunąć utworu", error: err });
    }
};

// Inkrementacja odsłuchań
const incrementStreamCount = async (req, res) => {
    try {
        const songID = req.params.id;
        const userID = req.user?.id;

        const song = await Song.findByPk(songID);
        if (!song) return res.status(404).json({ message: "Nie znaleziono utworu" });

        const recent = await StreamHistory.findOne({
            where: {
                userID,
                targetType: "song",
                targetID: songID,
                createdAt: { [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
        });

        if (recent) {
            return res.json({ message: "Odtworzenie zostało już niedawno zliczone", streamCount: song.streamCount });
        }

        await song.increment("streamCount", { by: 1 });
        await StreamHistory.create({ userID, targetType: "song", targetID: songID });

        await song.reload();

        return res.json({ message: "Odtworzenie zostało zliczone", streamCount: song.streamCount });
    } catch (err) {
        console.error("STREAM ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// Polubienie utworu
const likeSong = async (req, res) => {
    try {
        const { id } = req.params;
        const userID = req.user.id;

        const song = await Song.findByPk(id);
        if (!song) return res.status(404).json({ message: "Nie znaleziono utworu" });

        const exists = await UserSongLikes.findOne({ where: { userID, songID: id } });
        if (exists) return res.status(400).json({ message: "Utwór jest już polubiony" });

        await UserSongLikes.create({ userID, songID: id });

        song.likeCount += 1;
        await song.save();

        await FavoriteSongs.create({ userID, songID: id });

        return res.json({ message: "Polubiono utwór", likeCount: song.likeCount });

    } catch (err) {
        console.log("LIKE ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// Anulowanie polubienia
const unlikeSong = async (req, res) => {
    try {
        const { id } = req.params;
        const userID = req.user.id;

        const song = await Song.findByPk(id);
        if (!song) return res.status(404).json({ message: "Nie znaleziono utworu" });

        // Sprawdzenie, czy polubiony
        const like = await UserSongLikes.findOne({ where: { userID, songID: id } });
        if (!like) {
            return res.status(400).json({ message: "Utwór nie jest polubion" });
        }

        await like.destroy();

        // Dekrementacja likeCount
        song.likeCount = Math.max(0, song.likeCount - 1);
        await song.save();

        // Usuwanie z ulubionych (favorites)
        await FavoriteSongs.destroy({ where: { userID, songID: id } });

        return res.json({ message: "Cofnięto polubienie", likeCount: song.likeCount });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getSong,
    getSongsList,
    getMySongs,
    uploadSong,
    updateSong,
    deleteSong,
    incrementStreamCount,
    likeSong,
    unlikeSong
}
