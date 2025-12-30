const { S3Client, PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const mm = require("music-metadata");
const {Op} = require("sequelize");

const { sequelize, models } = require("../models");
const Song = models.songs;
const CreatorProfile = models.creatorprofiles;
const User = models.users;
const UserSongLikes = models.usersonglikes;
const FavoriteSongs = models.favoritesongs;
const StreamHistory = models.streamhistory;

const { generateSignedUrl } = require("../config/s3");

require("dotenv").config();

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const getSong = async (req, res) => {
    try {
        const { songID } = req.params;

        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Song not found" });
        }

        if (song.moderationStatus !== "ACTIVE") {
            return res.status(403).json({
                message: "This song is not available"
            });
        }

        const audioKey = song.fileURL
            ? song.fileURL.split(".amazonaws.com/")[1]
            : null;

        const coverKey = song.coverURL
            ? song.coverURL.split(".amazonaws.com/")[1]
            : null;

        res.json({
            songID: song.songID,
            songName: song.songName,
            duration: song.duration,
            signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
            signedCover: coverKey ? await generateSignedUrl(coverKey) : null
        });

    } catch (err) {
        console.error("GET SONG ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Lista utworów
const getSongsList = async (req, res) => {
    try {
        const songs = await Song.findAll({
            where: {
                moderationStatus: "ACTIVE"},
            include: [
                {
                    model: CreatorProfile,
                    as: "creator",
                    attributes: ["creatorID"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["userID", "userName"],
                        },
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        const result = await Promise.all(
            songs.map(async (song) => {
                const audioKey = song.fileURL
                    ? song.fileURL.split(".amazonaws.com/")[1]
                    : null;

                const coverKey = song.coverURL
                    ? song.coverURL.split(".amazonaws.com/")[1]
                    : null;

                return {
                    songID: song.songID,
                    songName: song.songName,
                    creatorID: song.creatorID,
                    creatorName: song.creator?.user?.userName ?? null,
                    duration: song.duration,
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null
                };
            })
        );

        res.json(result);

    } catch (err) {
        console.error("GET SONGS LIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Upload utworu
const uploadSong = async (req, res) => {
    try {
        const audioFile = req.files?.file?.[0];
        const coverFile = req.files?.cover?.[0];
        const { genreID } = req.body;

        // Reset AUTO_INCREMENT jeśli pusto
        const count = await Song.count();
        if (count === 0) {
            await Song.sequelize.query("ALTER TABLE songs AUTO_INCREMENT = 1;");
        }

        if (!audioFile) {
            return res.status(400).json({ message: "Audio file is required" });
        }

        if (!genreID) {
            return res.status(400).json({ message: "genreID is required" });
        }

        // sprawdzenie czy gatunek istnieje
        const genre = await models.genres.findByPk(genreID);
        if (!genre) {
            return res.status(400).json({ message: "Invalid genreID" });
        }

        // Duration
        let duration = 0;
        try {
            const metadata = await mm.parseBuffer(audioFile.buffer);
            duration = Math.round(metadata.format.duration);
        } catch (err) {
            console.warn("Metadata error:", err);
        }

        if (!duration) return res.status(400).json({ message: "Invalid audio metadata" });

        const songName = audioFile.originalname.replace(/\.[^/.]+$/, "");

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator) {
            return res.status(403).json({ message: "Creator profile not found" });
        }

        // Stwórz najpierw rekord w bazie
        const song = await Song.create({
            songName,
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
            const ext = coverFile.originalname.split(".").pop();
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

        await song.update({ fileURL: audioURL, coverURL });

        return res.status(201).json({
            message: "Song uploaded successfully!",
            song,
            audioURL,
            coverURL
        });

    } catch (err) {
        console.log("UPLOAD ERROR:", err);
        return res.status(500).json({ message: "Upload failed", error: err });
    }
};

// Usuwanie utworu
const deleteSong = async (req, res) => {
    try {
        const { songID } = req.params;

        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Song not found" });
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

        const count = await Song.count();
        if (count === 0) {
            await Song.sequelize.query("ALTER TABLE songs AUTO_INCREMENT = 1;");
        }

        return res.json({
            message: "Song deleted",
            deletedFiles: objectsToDelete.map(x => x.Key),
            autoIncrementReset: count === 0
        });

    } catch (err) {
        console.log("DELETE ERROR:", err);
        return res.status(500).json({ message: "Delete failed", error: err });
    }
};

// Increment stream count
const incrementStreamCount = async (req, res) => {
    try {
        const songID = req.params.id;
        const userID = req.user?.id;

        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Song not found" });
        }

        const recent = await StreamHistory.findOne({
            where: {
                userID,
                targetType: "song",
                targetID: songID,
                createdAt: {
                    [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });

        if (recent) {
            return res.json({ message: "Stream already counted recently" });
        }

        await song.increment("streamCount");

        await StreamHistory.create({
            userID,
            targetType: "song",
            targetID: songID
        });

        res.json({
            message: "Stream counted",
            streamCount: song.streamCount + 1
        });

    } catch (err) {
        console.error("STREAM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Polubienie utworu
const likeSong = async (req, res) => {
    try {
        const { id } = req.params;
        const userID = req.user.id;

        const song = await Song.findByPk(id);
        if (!song) return res.status(404).json({ message: "Song not found" });

        const exists = await UserSongLikes.findOne({ where: { userID, songID: id } });
        if (exists) return res.status(400).json({ message: "Already liked" });

        await UserSongLikes.create({ userID, songID: id });

        song.likeCount += 1;
        await song.save();

        await FavoriteSongs.create({ userID, songID: id });

        return res.json({ message: "Song liked", likeCount: song.likeCount });

    } catch (err) {
        console.log("LIKE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// Anulowanie polubienia
const unlikeSong = async (req, res) => {
    try {
        const { id } = req.params;
        const userID = req.user.id;

        const song = await Song.findByPk(id);
        if (!song) return res.status(404).json({ message: "Song not found" });

        // Sprawdzenie czy polubiony
        const like = await UserSongLikes.findOne({ where: { userID, songID: id } });
        if (!like) {
            return res.status(400).json({ message: "Not liked" });
        }

        await like.destroy();

        // Dekrementacja likeCount
        song.likeCount = Math.max(0, song.likeCount - 1);
        await song.save();

        // Usuwanie z ulubionych (favorites)
        await FavoriteSongs.destroy({ where: { userID, songID: id } });

        // Jeśli po usunięciu tabela jest pusta -> reset AUTO_INCREMENT
        const count = await FavoriteSongs.count();
        if (count === 0) {
            await sequelize.query("ALTER TABLE favoriteSongs AUTO_INCREMENT = 1");
        }

        return res.json({ message: "Song unliked", likeCount: song.likeCount });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getSong,
    getSongsList,
    uploadSong,
    deleteSong,
    incrementStreamCount,
    likeSong,
    unlikeSong
}
