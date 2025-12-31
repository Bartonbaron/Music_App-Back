const { models, sequelize } = require("../models");
const { PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { s3, generateSignedUrl } = require("../config/s3");
const {Op} = require("sequelize");
const extractKey = require("../utils/extractKey");
const uploadCover = require("../utils/uploadCover");
const deleteCover = require("../utils/deleteCover");

const Album = models.albums;
const Song = models.songs;
const Library = models.library;
const LibraryAlbums = models.libraryalbums;
const CreatorProfile = models.creatorprofiles;
const User = models.users;

const BUCKET = process.env.AWS_S3_BUCKET;

const getAllAlbums = async (req, res) => {
    try {
        const albums = await Album.findAll({
            where: {
                isPublished: true,
                moderationStatus: "ACTIVE"
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
                            attributes: ["userID", "userName"]
                        }
                    ]
                }
            ],
            order: [["createdAt", "DESC"]]
        });

        const result = await Promise.all(
            albums.map(async (album) => ({
                ...album.toJSON(),
                signedCover: album.coverURL
                    ? await generateSignedUrl(extractKey(album.coverURL))
                    : null
            }))
        );

        res.json(result);

    } catch (err) {
        console.error("GET ALBUMS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getAlbum = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id, {
            include: [
                {
                    model: CreatorProfile,
                    as: "creator",
                    attributes: ["creatorID", "userID"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["userID", "userName"]
                        }
                    ]
                }
            ]
        });

        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        if (album.moderationStatus !== "ACTIVE") {
            return res.status(403).json({
                message: "Album is not available"
            });
        }

        if (!album.isPublished) {
            const creator = await CreatorProfile.findOne({
                where: { userID: req.user.id }
            });

            if (!creator || creator.creatorID !== album.creatorID) {
                return res.status(403).json({
                    message: "Album will be released on",
                    releaseDate: album.releaseDate
                });
            }
        }

        res.json({
            ...album.toJSON(),
            signedCover: album.coverURL
                ? await generateSignedUrl(extractKey(album.coverURL))
                : null
        });

    } catch (err) {
        console.error("GET ALBUM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};


const getAlbumSongs = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        if (album.moderationStatus !== "ACTIVE") {
            return res.status(403).json({ message: "Album is not available" });
        }

        // premiera
        if (!album.isPublished) {
            const creator = await CreatorProfile.findOne({
                where: { userID: req.user.id }
            });

            if (!creator || creator.creatorID !== album.creatorID) {
                return res.status(403).json({
                    message: "Album will be released on",
                    releaseDate: album.releaseDate
                });
            }
        }

        const songs = await Song.findAll({
            where: { albumID: album.albumID },
            order: [["trackNumber", "ASC"]]
        });

        const result = await Promise.all(
            songs.map(async (song) => ({
                ...song.toJSON(),
                signedAudio: song.fileURL
                    ? await generateSignedUrl(extractKey(song.fileURL))
                    : null,
                signedCover: song.coverURL
                    ? await generateSignedUrl(extractKey(song.coverURL))
                    : null
            }))
        );

        const albumSignedCover = album.coverURL
            ? await generateSignedUrl(extractKey(album.coverURL))
            : null;

        res.json({
            albumID: album.albumID,
            albumSignedCover,
            count: result.length,
            songs: result
        });

    } catch (err) {
        console.error("GET ALBUM SONGS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};


const addAlbumToLibrary = async (req, res) => {
    try {
        const userID = req.user.id;
        const albumID = req.params.id;

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        // Blokada premiery
        if (!album.isPublished) {
            const creator = await CreatorProfile.findOne({
                where: { userID }
            });

            if (!creator || creator.creatorID !== album.creatorID) {
                return res.status(403).json({
                    message: "Album will be released on",
                    releaseDate: album.releaseDate
                });
            }
        }

        const library = await Library.findOne({
            where: { userID }
        });

        const exists = await LibraryAlbums.findOne({
            where: {
                libraryID: library.libraryID,
                albumID
            }
        });

        if (exists) {
            return res.status(400).json({ message: "Album already in library" });
        }

        await LibraryAlbums.create({
            libraryID: library.libraryID,
            albumID
        });

        res.json({ message: "Album added to library" });

    } catch (err) {
        console.error("ADD ALBUM TO LIBRARY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const removeAlbumFromLibrary = async (req, res) => {
    try {
        const userID = req.user.id;
        const albumID = req.params.id;

        const library = await Library.findOne({
            where: { userID }
        });

        await LibraryAlbums.destroy({
            where: {
                libraryID: library.libraryID,
                albumID
            }
        });

        res.json({ message: "Album removed from library" });

    } catch (err) {
        console.error("REMOVE ALBUM FROM LIBRARY ERROR:", err);
        res.status(500).json({ message: "Server error" });
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
            return res.status(400).json({ message: "albumName is required" });
        }

        if (!genreID) {
            return res.status(400).json({ message: "genreID is required" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator) {
            return res.status(403).json({ message: "Creator profile not found" });
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
            message: "Album created",
            album
        });

    } catch (err) {
        console.error("CREATE ALBUM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const updateAlbum = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const { albumName, description, releaseDate } = req.body;

        await album.update({
            albumName: albumName ?? album.albumName,
            description: description ?? album.description,
            releaseDate: releaseDate ?? album.releaseDate
        });

        res.json({ message: "Album updated", album });

    } catch (err) {
        console.error("UPDATE ALBUM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteAlbum = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const coverKey = extractKey(album.coverURL);

        if (coverKey) {
            await s3.send(new DeleteObjectsCommand({
                Bucket: BUCKET,
                Delete: { Objects: [{ Key: coverKey }] }
            }));
        }

        await album.destroy();

        const count = await Album.count();
        if (count === 0) {
            await sequelize.query("ALTER TABLE albums AUTO_INCREMENT = 1");
        }

        res.json({ message: "Album deleted" });

    } catch (err) {
        console.error("DELETE ALBUM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const addSongToAlbum = async (req, res) => {
    try {
        const { albumID, songID } = req.params;

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Song not found" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator) {
            return res.status(403).json({ message: "Creator profile not found" });
        }

        if (creator.creatorID !== album.creatorID) {
            return res.status(403).json({
                message: "You are not the owner of this album"
            });
        }

        if (song.creatorID !== creator.creatorID) {
            return res.status(400).json({
                message: "Song does not belong to you"
            });
        }

        if (song.albumID && song.albumID !== album.albumID) {
            return res.status(400).json({
                message: "Song already belongs to another album"
            });
        }

        const lastTrack = await Song.max("trackNumber", {
            where: { albumID }
        });

        await song.update({
            albumID,
            trackNumber: (lastTrack || 0) + 1
        });

        res.json({ message: "Song added to album" });

    } catch (err) {
        console.error("ADD SONG TO ALBUM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const addSongsToAlbumBulk = async (req, res) => {
    try {
        const { albumID } = req.params;
        const { songIDs } = req.body;

        if (!Array.isArray(songIDs) || !songIDs.length) {
            return res.status(400).json({ message: "songIDs must be an array" });
        }

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const songs = await Song.findAll({
            where: {
                songID: songIDs,
                creatorID: creator.creatorID
            }
        });

        if (songs.length !== songIDs.length) {
            return res.status(400).json({
                message: "Some songs do not belong to you"
            });
        }

        let trackNumber =
            (await Song.max("trackNumber", { where: { albumID } })) || 0;

        for (const song of songs) {
            trackNumber++;
            await song.update({ albumID, trackNumber });
        }

        res.json({ message: "Songs added to album", count: songs.length });

    } catch (err) {
        console.error("ADD SONGS TO ALBUM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const removeSongFromAlbum = async (req, res) => {
    try {
        const { albumID, songID } = req.params;

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        const song = await Song.findByPk(songID);
        if (!song || song.albumID !== album.albumID) {
            return res.status(400).json({ message: "Song is not in this album" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Not authorized" });
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

        res.json({ message: "Song removed from album" });

    } catch (err) {
        console.error("REMOVE SONG FROM ALBUM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const reorderAlbumSongs = async (req, res) => {
    try {
        const { albumID } = req.params;
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({ message: "order must be an array" });
        }

        const album = await Album.findByPk(albumID);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const items = await Song.findAll({
            where: { albumID },
            attributes: ["songID"],
            raw: true
        });

        const albumSongIDs = items.map(i => i.get("songID"));

        // Liczba
        if (order.length !== albumSongIDs.length) {
            return res.status(400).json({
                message: "Order must include all songs in the album"
            });
        }

        // Przynależność
        const invalid = order.filter(id => !albumSongIDs.includes(id));
        if (invalid.length > 0) {
            return res.status(400).json({
                message: "Some songs do not belong to this album",
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

        res.json({ message: "Album tracks reordered" });

    } catch (err) {
        console.error("REORDER ALBUM SONGS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const uploadAlbumCover = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) return res.status(404).json({ message: "Album not found" });

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const coverURL = await uploadCover({
            file: req.files?.cover?.[0],
            oldURL: album.coverURL,
            folder: "covers/albums",
            filename: album.albumID
        });

        await album.update({ coverURL });

        res.json({ message: "Album cover uploaded", coverURL });

    } catch (err) {
        console.error("UPLOAD ALBUM COVER ERROR:", err);
        res.status(500).json({ message: err.message || "Upload failed" });
    }
};

const deleteAlbumCover = async (req, res) => {
    try {
        const album = await Album.findByPk(req.params.id);
        if (!album) {
            return res.status(404).json({ message: "Album not found" });
        }

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator || creator.creatorID !== album.creatorID) {
            return res.status(403).json({ message: "Not authorized" });
        }

        if (!album.coverURL) {
            return res.status(400).json({ message: "Album has no cover" });
        }

        await deleteCover({ oldURL: album.coverURL });

        await album.update({ coverURL: null });

        res.json({ message: "Album cover deleted" });

    } catch (err) {
        console.error("DELETE ALBUM COVER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const publishAlbum = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { albumName, description, releaseDate, genreID, tracks } = req.body;
        const creatorID = req.user.creatorID;

        // Walidacje podstawowe
        if (!albumName || !genreID) {
            await t.rollback();
            return res.status(400).json({
                message: "albumName and genreID are required"
            });
        }

        if (!Array.isArray(tracks) || tracks.length === 0) {
            await t.rollback();
            return res.status(400).json({
                message: "Album must contain at least one track"
            });
        }

        // Sprawdzenie duplikatów trackNumber
        const trackNumbers = tracks.map(t => t.trackNumber);
        const uniqueTrackNumbers = new Set(trackNumbers);
        if (trackNumbers.length !== uniqueTrackNumbers.size) {
            await t.rollback();
            return res.status(400).json({
                message: "Duplicate track numbers are not allowed"
            });
        }

        // Utwórz album
        const album = await Album.create({
            albumName,
            description: description || null,
            releaseDate: releaseDate || null,
            genreID,
            creatorID,
            isPublished: true,
            moderationStatus: "ACTIVE"
        }, { transaction: t });

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
                message: "Some tracks are invalid, already assigned to an album, or do not belong to you"
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

        res.status(201).json({
            message: "Album published successfully",
            albumID: album.albumID
        });

    } catch (err) {
        await t.rollback();
        console.error("PUBLISH ALBUM ERROR:", err);
        res.status(500).json({
            message: "Server error while publishing album"
        });
    }
};

module.exports = {
    getAllAlbums,
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




