require("dotenv").config();
const { models, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { s3 } = require("../../config/s3");
const { DeleteObjectsCommand } = require("@aws-sdk/client-s3");

const BUCKET = process.env.AWS_S3_BUCKET;

const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey");
const uploadCover = require("../../utils/uploadCover");
const deleteCover = require("../../utils/deleteCover");

const Album = models.albums;
const Song = models.songs;
const Library = models.library;
const LibraryAlbums = models.libraryalbums;
const CreatorProfile = models.creatorprofiles;
const User = models.users;

const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);

const getReqUserID = (req) => Number(req.user?.userID ?? req.user?.id);
const isAdminReq = (req) => Number(req.user?.roleID) === ADMIN_ROLE_ID;

const canSeeUnpublishedOrHiddenAlbum = async (album, req) => {
    if (!album) return false;

    // admin zawsze
    if (isAdminReq(req)) return true;

    // właściciel (twórca albumu)
    // 1) jeśli JWT niesie creatorID:
    const tokenCreatorID = Number(req.user?.creatorID);
    if (Number.isFinite(tokenCreatorID) && tokenCreatorID > 0) {
        return tokenCreatorID === Number(album.creatorID);
    }

    // 2) fallback: creatorProfile po userID
    const userID = getReqUserID(req);
    if (!Number.isFinite(userID) || userID <= 0) return false;

    const creator = await CreatorProfile.findOne({
        where: { userID },
        attributes: ["creatorID"],
    });

    if (!creator) return false;
    return Number(creator.creatorID) === Number(album.creatorID);
};

function computeIsPublished(releaseDate) {
    if (!releaseDate) return true;
    const now = new Date();
    const release = new Date(releaseDate);
    if (Number.isNaN(release.getTime())) return true; // albo false + walidacja
    return release.getTime() <= now.getTime();
}

const signCover = async (coverURL) => {
    if (!coverURL) return null;
    try {
        return await generateSignedUrl(extractKey(coverURL));
    } catch {
        return null;
    }
};

const signAudio = async (fileURL) => {
    if (!fileURL) return null;
    try {
        return await generateSignedUrl(extractKey(fileURL));
    } catch {
        return null;
    }
};

// GET /albums (publiczne: tylko published + ACTIVE)
const getAllAlbums = async (req, res) => {
    try {
        const albums = await Album.findAll({
            where: {
                isPublished: true,
                moderationStatus: "ACTIVE",
            },
            include: [
                {
                    model: CreatorProfile,
                    as: "creator",
                    attributes: ["creatorID", "userID"],
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
            albums.map(async (album) => ({
                ...album.toJSON(),
                signedCover: await signCover(album.coverURL),
            }))
        );

        return res.json(result);
    } catch (err) {
        console.error("GET ALBUMS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// GET /albums/my (creator: wszystkie moje, także unpublished/hidden)
const getMyAlbums = async (req, res) => {
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

        const albums = await Album.findAll({
            where: { creatorID: creator.creatorID },
            order: [["createdAt", "DESC"]],
        });

        const presented = await Promise.all(
            albums.map(async (a) => ({
                ...a.toJSON(),
                signedCover: await signCover(a.coverURL),
            }))
        );

        return res.json({ albums: presented });
    } catch (err) {
        console.error("GET MY ALBUMS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const getAlbum = async (req, res) => {
    try {
        const albumID = Number(req.params.id);
        if (!Number.isFinite(albumID) || albumID <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe ID albumu" });
        }

        const album = await Album.findByPk(albumID, {
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
                            attributes: ["userID", "userName"],
                        },
                    ],
                },
            ],
        });

        if (!album) return res.status(404).json({ message: "Nie znaleziono albumu" });

        const privileged = await canSeeUnpublishedOrHiddenAlbum(album, req);

        if (album.moderationStatus !== "ACTIVE" && !privileged) {
            return res.status(403).json({ message: "Album jest niedostępny" });
        }

        if (!album.isPublished && !privileged) {
            return res.status(403).json({
                releaseDate: album.releaseDate,
                message: `Album zostanie wydany dnia ${album.releaseDate}`,
            });
        }

        return res.json({
            ...album.toJSON(),
            signedCover: await signCover(album.coverURL),
        });
    } catch (err) {
        console.error("GET ALBUM ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const getAlbumSongs = async (req, res) => {
    try {
        const albumID = Number(req.params.id);
        if (!Number.isFinite(albumID) || albumID <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe ID albumu" });
        }

        const album = await Album.findByPk(albumID);
        if (!album) return res.status(404).json({ message: "Nie znaleziono albumu" });

        const privileged = await canSeeUnpublishedOrHiddenAlbum(album, req);

        if (album.moderationStatus !== "ACTIVE" && !privileged) {
            return res.status(403).json({ message: "Album jest niedostępny" });
        }

        if (!album.isPublished && !privileged) {
            return res.status(403).json({
                message: "Album zostanie wydany dnia",
                releaseDate: album.releaseDate,
            });
        }

        const songs = await Song.findAll({
            where: { albumID: album.albumID },
            order: [["trackNumber", "ASC"]],
        });

        const result = await Promise.all(
            songs.map(async (song) => {
                const hidden = song.moderationStatus === "HIDDEN";

                return {
                    ...song.toJSON(),
                    isHidden: hidden,
                    signedAudio:
                        !hidden && song.fileURL
                            ? await signAudio(song.fileURL)
                            : null,
                    signedCover: await signCover(song.coverURL),
                };
            })
        );

        return res.json({
            albumID: album.albumID,
            albumSignedCover: await signCover(album.coverURL),
            count: result.length,
            songs: result,
        });
    } catch (err) {
        console.error("GET ALBUM SONGS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const addAlbumToLibrary = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        const albumID = Number(req.params.id);

        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }
        if (!Number.isFinite(albumID) || albumID <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe ID albumu" });
        }

        const album = await Album.findByPk(albumID);
        if (!album) return res.status(404).json({ message: "Nie znaleziono albumu" });

        const privileged = await canSeeUnpublishedOrHiddenAlbum(album, req);

        if (album.moderationStatus !== "ACTIVE" && !privileged) {
            return res.status(403).json({ message: "Album jest niedostępny" });
        }

        if (!album.isPublished && !privileged) {
            return res.status(403).json({
                message: "Album zostanie wydany dnia",
                releaseDate: album.releaseDate,
            });
        }

        const library = await Library.findOne({ where: { userID } });
        if (!library) return res.status(404).json({ message: "Nie znaleziono biblioteki" });

        const exists = await LibraryAlbums.findOne({
            where: { libraryID: library.libraryID, albumID },
        });

        if (exists) {
            return res.status(400).json({ message: "Album jest już w bibliotece" });
        }

        await LibraryAlbums.create({ libraryID: library.libraryID, albumID });

        return res.json({ message: "Album dodano do biblioteki" });
    } catch (err) {
        console.error("ADD ALBUM TO LIBRARY ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// DELETE /albums/:id/library
const removeAlbumFromLibrary = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        const albumID = Number(req.params.id);

        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }
        if (!Number.isFinite(albumID) || albumID <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe ID albumu" });
        }

        const library = await Library.findOne({ where: { userID } });
        if (!library) return res.status(404).json({ message: "Nie znaleziono biblioteki" });

        await LibraryAlbums.destroy({
            where: { libraryID: library.libraryID, albumID },
        });

        return res.json({ message: "Album usunięto z biblioteki" });
    } catch (err) {
        console.error("REMOVE ALBUM FROM LIBRARY ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const createAlbum = async (req, res) => {
    try {
        const { albumName, description, releaseDate, genreID } = req.body;
        const coverFile = req.files?.cover?.[0];

        const now = new Date();
        const release = releaseDate ? new Date(releaseDate) : null;

        const isPublished = !release || release <= now;

        if (!albumName) {
            return res.status(400).json({ message: "Pole albumName jest wymagane" });
        }

        if (!genreID) {
            return res.status(400).json({ message: "Pole genreID jest wymagane" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator) {
            return res.status(403).json({ message: "Nie znaleziono profilu twórcy" });
        }

        const album = await Album.create({
            albumName,
            description: description || null,
            releaseDate: releaseDate || null,
            genreID,
            creatorID: creator.creatorID,
            coverURL: null,
            isPublished
        });

        if (coverFile) {
            const coverURL = await uploadCover({
                file: coverFile,
                oldURL: null,
                folder: "covers/albums",
                filename: album.albumID
            });

            await album.update({ coverURL });
        }

        res.status(201).json({
            message: "Utworzono album",
            album
        });

    } catch (err) {
        console.error("CREATE ALBUM ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const updateAlbum = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) {
            return res.status(404).json({ message: "Nie znaleziono albumu" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id },
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        const { albumName, description, releaseDate, genreID } = req.body;

        // releaseDate docelowe (po update)
        const nextReleaseDate =
            releaseDate !== undefined ? (releaseDate ? releaseDate : null) : album.releaseDate;

        const nextIsPublished = computeIsPublished(nextReleaseDate);

        await album.update({
            ...(albumName !== undefined && { albumName }),
            ...(description !== undefined && { description: description || null }),
            ...(genreID !== undefined && { genreID }),
            ...(releaseDate !== undefined && { releaseDate: nextReleaseDate }),
            isPublished: nextIsPublished,
        });

        return res.json({ message: "Zaktualizowano album", album });
    } catch (err) {
        console.error("UPDATE ALBUM ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const deleteAlbum = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) {
            return res.status(404).json({ message: "Nie znaleziono albumu" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        const coverKey = extractKey(album.coverURL);

        if (coverKey) {
            await s3.send(new DeleteObjectsCommand({
                Bucket: BUCKET,
                Delete: { Objects: [{ Key: coverKey }] }
            }));
        }

        await album.destroy();

        res.json({ message: "Usunięto album" });

    } catch (err) {
        console.error("DELETE ALBUM ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const addSongToAlbum = async (req, res) => {
    try {
        const { albumID, songID } = req.params;

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Nie znaleziono albumu" });
        }

        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Nie znaleziono utworu" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator) {
            return res.status(403).json({ message: "Nie znaleziono profilu twórcy" });
        }

        if (creator.creatorID !== album.creatorID) {
            return res.status(403).json({
                message: "Nie jesteś właścicielem tego albumu"
            });
        }

        if (song.creatorID !== creator.creatorID) {
            return res.status(400).json({
                message: "Ten utwór nie należy do Ciebie"
            });
        }

        if (song.albumID && song.albumID !== album.albumID) {
            return res.status(400).json({
                message: "Ten utwór należy już do innego albumu"
            });
        }

        const lastTrack = await Song.max("trackNumber", {
            where: { albumID }
        });

        await song.update({
            albumID,
            trackNumber: (lastTrack || 0) + 1
        });

        res.json({ message: "Dodano utwór do albumu" });

    } catch (err) {
        console.error("ADD SONG TO ALBUM ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const addSongsToAlbumBulk = async (req, res) => {
    try {
        const { albumID } = req.params;
        const { songIDs } = req.body || {};

        if (!Array.isArray(songIDs) || songIDs.length === 0) {
            return res.status(400).json({ message: "songIDs musi być tablicą" });
        }

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Nie znaleziono albumu" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        const songs = await Song.findAll({
            where: {
                songID: songIDs,
                creatorID: creator.creatorID
            }
        });

        if (songs.length !== songIDs.length) {
            return res.status(400).json({
                message: "Niektóre utwory nie należą do Ciebie"
            });
        }

        let trackNumber =
            (await Song.max("trackNumber", { where: { albumID } })) || 0;

        for (const song of songs) {
            trackNumber++;
            await song.update({ albumID, trackNumber });
        }

        res.json({ message: "Dodano utwory do albumu", count: songs.length });

    } catch (err) {
        console.error("ADD SONGS TO ALBUM ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const removeSongFromAlbum = async (req, res) => {
    try {
        const { albumID, songID } = req.params;

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Nie znaleziono albumu" });
        }

        const song = await Song.findByPk(songID);
        if (!song || song.albumID !== album.albumID) {
            return res.status(400).json({ message: "Utwór nie znajduje się w tym albumie" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        const removedTrack = song.trackNumber;

        await song.update({
            albumID: null,
            trackNumber: null
        });

        // przesunięcie tracków
        await Song.increment(
            { trackNumber: -1 },
            {
                where: {
                    albumID,
                    trackNumber: { [Op.gt]: removedTrack }
                }
            }
        );

        res.json({ message: "Usunięto utwór z albumu" });

    } catch (err) {
        console.error("REMOVE SONG FROM ALBUM ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const reorderAlbumSongs = async (req, res) => {
    try {
        const { albumID } = req.params;
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({ message: "order musi być tablicą" });
        }

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Nie znaleziono albumu" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        const items = await Song.findAll({
            where: { albumID },
            attributes: ["songID"],
            raw: true
        });

        const albumSongIDs = items.map(i => i.songID);

        // Liczba
        if (order.length !== albumSongIDs.length) {
            return res.status(400).json({
                message: "Kolejność musi zawierać wszystkie utwory z albumu"
            });
        }

        // Przynależność
        const invalid = order.filter(id => !albumSongIDs.includes(id));
        if (invalid.length > 0) {
            return res.status(400).json({
                message: "Niektóre utwory nie należą do tego albumu",
                invalidSongIDs: invalid
            });
        }

        // Zmiana kolejności
        for (let i = 0; i < order.length; i++) {
            await Song.update(
                { trackNumber: i + 1 },
                {
                    where: {
                        songID: order[i],
                        albumID
                    }
                }
            );
        }

        res.json({ message: "Zmieniono kolejność utworów w albumie" });

    } catch (err) {
        console.error("REORDER ALBUM SONGS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const uploadAlbumCover = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) return res.status(404).json({ message: "Nie znaleziono albumu" });

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        const coverURL = await uploadCover({
            file: req.files?.cover?.[0],
            oldURL: album.coverURL,
            folder: "covers/albums",
            filename: album.albumID
        });

        await album.update({ coverURL });

        res.json({ message: "Przesłano okładkę albumu", coverURL });

    } catch (err) {
        console.error("UPLOAD ALBUM COVER ERROR:", err);
        res.status(500).json({ message: err.message || "Nie udało się przesłać pliku" });
    }
};

const deleteAlbumCover = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) {
            return res.status(404).json({ message: "Nie znaleziono albumu" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        if (!album.coverURL) {
            return res.status(400).json({ message: "Album nie ma okładki" });
        }

        await deleteCover({ oldURL: album.coverURL });

        await album.update({ coverURL: null });

        res.json({ message: "Usunięto okładkę albumu" });

    } catch (err) {
        console.error("DELETE ALBUM COVER ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const publishAlbum = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { albumName, description, releaseDate, genreID, tracks } = req.body;
        const creatorID = req.user.creatorID;

        if (!albumName || !genreID) {
            await t.rollback();
            return res.status(400).json({ message: "Pola albumName i genreID są wymagane" });
        }

        if (!Array.isArray(tracks) || tracks.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: "Album musi zawierać co najmniej jeden utwór" });
        }

        const trackNumbers = tracks.map((x) => x.trackNumber);
        const unique = new Set(trackNumbers);
        if (trackNumbers.length !== unique.size) {
            await t.rollback();
            return res.status(400).json({ message: "Zduplikowane numery utworów są niedozwolone" });
        }

        const isPublished = computeIsPublished(releaseDate);

        const album = await Album.create(
            {
                albumName,
                description: description || null,
                releaseDate: releaseDate || null,
                genreID,
                creatorID,
                isPublished,
                moderationStatus: "ACTIVE",
            },
            { transaction: t }
        );

        // Pobierz wszystkie utwory
        const songIDs = tracks.map(t => t.songID);

        const songs = await Song.findAll({
            where: {
                songID: songIDs,
                creatorID,
                albumID: null,
                moderationStatus: "ACTIVE"
            },
            transaction: t
        });

        if (songs.length !== tracks.length) {
            await t.rollback();
            return res.status(400).json({
                message: "Niektóre utwory są nieprawidłowe, są już przypisane do albumu albo nie należą do Ciebie"
            });
        }

        // Przypisz utwory do albumu
        for (const track of tracks) {
            await Song.update(
                {
                    albumID: album.albumID,
                    trackNumber: track.trackNumber
                },
                {
                    where: { songID: track.songID },
                    transaction: t
                }
            );
        }

        await t.commit();

        return res.status(201).json({
            message: "Album został opublikowany pomyślnie",
            albumID: album.albumID,
            isPublished: album.isPublished,
            releaseDate: album.releaseDate,
        });
    } catch (err) {
        await t.rollback();
        console.error("PUBLISH ALBUM ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera podczas publikowania albumu" });
    }
};

module.exports = {
    getAllAlbums,
    getMyAlbums,
    getAlbum,
    getAlbumSongs,
    addAlbumToLibrary,
    removeAlbumFromLibrary,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    addSongToAlbum,
    addSongsToAlbumBulk,
    removeSongFromAlbum,
    reorderAlbumSongs,
    uploadAlbumCover,
    deleteAlbumCover,
    publishAlbum
};