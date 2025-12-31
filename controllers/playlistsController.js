const { models } = require("../models");
const {Op} = require("sequelize");

const { generateSignedUrl } = require("../config/s3");

const extractKey = require("../utils/extractKey");

const {canAccessPlaylist, canEditPlaylist} = require("../utils/playlistPermissions");
const uploadCover = require("../utils/uploadCover");
const deleteCover = require("../utils/deleteCover");

const {s3} = require("../config/s3");
const {PutObjectCommand} = require("@aws-sdk/client-s3");
const Playlist = models.playlists;
const Song = models.songs;
const User = models.users;
const CreatorProfile = models.creatorprofiles;
const PlaylistSongs = models.playlistsongs;
const PlaylistActivity = models.playlistactivities;
const Library = models.library;
const LibraryPlaylists = models.libraryplaylists;

const createPlaylist = async (req, res) => {
    try {
        const { playlistName, description } = req.body;
        const coverFile = req.files?.cover?.[0];

        if (!playlistName) {
            return res.status(400).json({ message: "Playlist name is required" });
        }

        const playlist = await Playlist.create({
            playlistName,
            description: description || null,
            userID: req.user.id,
            coverURL: null
        });

        const library = await Library.findOne({ where: { userID: req.user.id } });
        if (library) {
            await LibraryPlaylists.findOrCreate({
                where: { libraryID: library.libraryID, playlistID: playlist.playlistID },
                defaults: { libraryID: library.libraryID, playlistID: playlist.playlistID },
            });
        }

        if (coverFile) {
            const coverURL = await uploadCover({
                file: coverFile,
                oldURL: null,
                folder: "covers/playlists",
                filename: playlist.playlistID
            });

            await playlist.update({ coverURL });
        }

        res.status(201).json({
            message: "Playlist created",
            playlist
        });

    } catch (err) {
        console.error("CREATE PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getUserPlaylists = async (req, res) => {
    try {
        const playlists = await Playlist.findAll({
            where: { userID: req.user.id }
        });

        const result = await Promise.all(
            playlists.map(async (playlist) => ({
                ...playlist.toJSON(),
                signedCover: playlist.coverURL
                    ? await generateSignedUrl(extractKey(playlist.coverURL))
                    : null
            }))
        );

        res.json(result);

    } catch (err) {
        console.error("GET MY PLAYLISTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getPlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName"],
                },
            ],
        });
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found" });
        }

        if (playlist.moderationStatus !== "ACTIVE") {
            return res.status(403).json({
                message: "Playlist is not available"
            });
        }

        if (playlist.visibility === "R" && playlist.userID !== req.user.id) {
            return res.status(403).json({
                message: "This playlist is private"
            });
        }

        res.json({
            ...playlist.toJSON(),
            signedCover: playlist.coverURL
                ? await generateSignedUrl(extractKey(playlist.coverURL))
                : null
        });

    } catch (err) {
        console.error("GET PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getPlaylistActivity = async (req, res) => {
    try {
        const playlistID = req.params.id;

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found" });
        }

        if (!canAccessPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "This playlist is private" });
        }

        const activities = await PlaylistActivity.findAll({
            where: { playlistID },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName"]
                },
                {
                    model: Song,
                    as: "song",
                    attributes: ["songID", "songName"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit: 50
        });

        res.json(activities);

    } catch (err) {
        console.error("GET PLAYLIST ACTIVITY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const updatePlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findByPk(req.params.id);

        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" });

        if (playlist.userID !== req.user.id)
            return res.status(403).json({ message: "You can edit only your own playlists" });

        const { playlistName, description, visibility, isCollaborative } = req.body;

        await playlist.update({
            ...(playlistName !== undefined && { playlistName }),
            ...(description !== undefined && { description }),
            ...(visibility !== undefined && { visibility }),
            ...(isCollaborative !== undefined && { isCollaborative }),
        });

        res.json({
            message: "Playlist updated",
            playlist
        });

    } catch (err) {
        console.error("PATCH PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const deletePlaylist = async (req, res) => {
    const t = await Playlist.sequelize.transaction();
    let coverURL = null;

    try {
        const playlist = await Playlist.findByPk(req.params.id, { transaction: t });

        if (!playlist) {
            await t.rollback();
            return res.status(404).json({ message: "Playlist not found" });
        }

        if (playlist.userID !== req.user.id) {
            await t.rollback();
            return res.status(403).json({ message: "You can delete only your own playlists" });
        }

        const playlistID = playlist.playlistID;
        coverURL = playlist.coverURL || null;

        await LibraryPlaylists.destroy({ where: { playlistID }, transaction: t });
        await PlaylistSongs.destroy({ where: { playlistID }, transaction: t });
        await PlaylistActivity.destroy({ where: { playlistID }, transaction: t });

        await playlist.destroy({ transaction: t });

        await t.commit();

        if (coverURL) {
            try {
                await deleteCover({ oldURL: coverURL });
            } catch (e) {
                console.warn("DELETE PLAYLIST COVER FAILED (post-commit):", e?.message || e);
            }
        }

        return res.json({ message: "Playlist deleted" });
    } catch (err) {
        try { await t.rollback(); } catch (_) {}
        console.error("DELETE PLAYLIST ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const addSongToPlaylist = async (req, res) => {
    try {
        const { playlistID } = req.params;
        const { songID } = req.body;

        if (!songID) {
            return res.status(400).json({ message: "songID is required" });
        }

        // Znajdź playlistę
        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found" });
        }

        if (!canAccessPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "This playlist is private" });
        }

        if (!canEditPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "Not authorized to modify this playlist" });
        }

        // Sprawdź czy utwór istnieje
        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Song not found" });
        }

        // Sprawdź, czy utwór nie istnieje już w playliście
        const exists = await PlaylistSongs.findOne({
            where: { playlistID, songID }
        });

        if (exists) {
            return res.status(400).json({ message: "Song already in playlist" });
        }

        // Ustal pozycję jako ostatnią
        const lastPos = await PlaylistSongs.max("position", { where: { playlistID } }) || 0;

        await PlaylistSongs.create({
            playlistID,
            songID,
            position: lastPos + 1
        });

        await PlaylistActivity.create({
            playlistID: playlist.playlistID,
            songID,
            userID: req.user.id,
            action: "ADD"
        });

        res.status(201).json({ message: "Song added to playlist" });

    } catch (err) {
        console.error("ADD SONG TO PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const removeSongFromPlaylist = async (req, res) => {
    try {
        const { playlistID, songID } = req.params;

        // Znajdź playlistę
        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found" });
        }

        if (!canAccessPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "This playlist is private" });
        }

        if (!canEditPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "Not authorized to modify this playlist" });
        }

        // Sprawdź czy utwór istnieje w playliście
        const entry = await PlaylistSongs.findOne({
            where: { playlistID, songID }
        });

        if (!entry) {
            return res.status(400).json({ message: "Song is not in this playlist" });
        }

        const removedPosition = entry.position;

        // Usuń z playlisty
        await entry.destroy();

        await PlaylistActivity.create({
            playlistID: playlist.playlistID,
            songID,
            userID: req.user.id,
            action: "REMOVE"
        });

        // Aktualizuj pozycje pozostałych utworów
        await PlaylistSongs.increment(
            { position: -1 },
            {
                where: {
                    playlistID,
                    position: { [Op.gt]: removedPosition }
                }
            }
        );

        res.json({ message: "Song removed from playlist" });

    } catch (err) {
        console.error("REMOVE SONG FROM PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getPlaylistSongs = async (req, res) => {
    try {
        const playlistID = req.params.id;

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });

        if (!canAccessPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "This playlist is private" });
        }

        const items = await PlaylistSongs.findAll({
            where: { playlistID: playlist.playlistID },
            include: [
                {
                    model: Song,
                    as: "song",
                    include: [
                        {
                            model: CreatorProfile,
                            as: "creator",
                            include: [{ model: User, as: "user", attributes: ["userID", "userName"] }],
                        },
                    ],
                },
            ],
            order: [["position", "ASC"]],
        });

        const result = await Promise.all(
            items.map(async (item) => {
                const s = item.song;

                return {
                    playlistSongID: item.playlistSongID,
                    position: item.position,

                    creatorName: s?.creator?.user?.userName ?? null,

                    song: s
                        ? {
                            ...s.toJSON(),
                            creatorName: s.creator?.user?.userName ?? null,

                            signedAudio: s.fileURL ? await generateSignedUrl(extractKey(s.fileURL)) : null,
                            signedCover: s.coverURL ? await generateSignedUrl(extractKey(s.coverURL)) : null,
                        }
                        : null,
                };
            })
        );

        res.json(result);
    } catch (err) {
        console.error("GET PLAYLIST SONGS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Dodawanie do biblioteki
const addPlaylistToLibrary = async (req, res) => {
    try {
        const playlistID = req.params.id;

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found" });
        }

        if (!canAccessPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "This playlist is private" });
        }

        const library = await Library.findOne({
            where: { userID: req.user.id }
        });

        if (!library) {
            return res.status(404).json({ message: "Library not found" });
        }

        const exists = await LibraryPlaylists.findOne({
            where: { libraryID: library.libraryID, playlistID }
        });

        if (exists) {
            return res.status(400).json({ message: "Playlist already in library" });
        }

        await LibraryPlaylists.create({
            libraryID: library.libraryID,
            playlistID
        });

        res.json({ message: "Playlist added to library" });

    } catch (err) {
        console.error("ADD PLAYLIST TO LIBRARY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const reorderPlaylistSongs = async (req, res) => {
    try {
        const { order } = req.body;
        const playlistID = req.params.id;

        if (!Array.isArray(order))
            return res.status(400).json({ message: "Order must be an array" });

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" });

        if (!canAccessPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "This playlist is private" });
        }

        if (!canEditPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "Not authorized to modify this playlist" });
        }

        const items = await PlaylistSongs.findAll({
            where: { playlistID },
            attributes: ["songID"],
            raw: true
        });

        const playlistSongIDs = items.map(i => i.songID);

        if (order.length !== playlistSongIDs.length) {
            return res.status(400).json({
                message: "Order must include all songs in the playlist"
            });
        }

        const invalid = order.filter(id => !playlistSongIDs.includes(id));
        if (invalid.length) {
            return res.status(400).json({
                message: "Some songs do not belong to this playlist",
                invalidSongIDs: invalid
            });
        }

        for (let i = 0; i < order.length; i++) {
            await PlaylistSongs.update(
                { position: i + 1 },
                {
                    where: {
                        playlistID,
                        songID: order[i]
                    }
                }
            );
        }

        res.json({ message: "Playlist reordered" });

    } catch (err) {
        console.error("REORDER PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// REMOVE
const removePlaylistFromLibrary = async (req, res) => {
    try {
        const playlistID = req.params.id;

        const library = await Library.findOne({
            where: { userID: req.user.id }
        });

        await LibraryPlaylists.destroy({
            where: { libraryID: library.libraryID, playlistID }
        });

        res.json({ message: "Playlist removed from library" });

    } catch (err) {
        console.error("REMOVE PLAYLIST FROM LIBRARY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const changePlaylistVisibility = async (req, res) => {
    try {
        const { visibility } = req.body;
        const playlistID = req.params.id;

        if (!["P", "R"].includes(visibility)) {
            return res.status(400).json({ message: "Invalid visibility value" });
        }

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" });

        if (playlist.userID !== req.user.id)
            return res.status(403).json({ message: "Only owner can change visibility" });

        playlist.visibility = visibility;
        await playlist.save();

        res.json({ message: "Visibility updated", visibility });

    } catch (err) {
        console.error("CHANGE PLAYLIST VISIBILITY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const toggleCollaborative = async (req, res) => {
    try {
        const { isCollaborative } = req.body;
        const playlistID = req.params.id;

        if (!["Y", "N"].includes(isCollaborative)) {
            return res.status(400).json({ message: "Invalid value" });
        }

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" });

        if (playlist.userID !== req.user.id)
            return res.status(403).json({ message: "Only owner can change collaborative mode" });

        playlist.isCollaborative = isCollaborative;
        await playlist.save();

        res.json({
            message: "Collaborative mode updated",
            isCollaborative
        });

    } catch (err) {
        console.error("TOGGLE COLLABORATIVE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const uploadPlaylistCover = async (req, res) => {
    try {
        const playlist = await Playlist.findByPk(req.params.id);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });

        if (playlist.userID !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const coverURL = await uploadCover({
            file: req.files?.cover?.[0],
            oldURL: playlist.coverURL,
            folder: "covers/playlists",
            filename: playlist.playlistID
        });

        await playlist.update({ coverURL });

        res.json({ message: "Playlist cover uploaded", coverURL });

    } catch (err) {
        console.error("UPLOAD PLAYLIST COVER ERROR:", err);
        res.status(500).json({ message: err.message || "Upload failed" });
    }
};

const deletePlaylistCover = async (req, res) => {
    try {
        const playlist = await Playlist.findByPk(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: "Playlist not found" });
        }

        if (playlist.userID !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        if (!playlist.coverURL) {
            return res.status(400).json({ message: "Playlist has no cover" });
        }

        await deleteCover({ oldURL: playlist.coverURL });

        await playlist.update({ coverURL: null });

        res.json({ message: "Playlist cover deleted" });

    } catch (err) {
        console.error("DELETE PLAYLIST COVER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createPlaylist,
    getUserPlaylists,
    getPlaylist,
    getPlaylistActivity,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    getPlaylistSongs,
    addPlaylistToLibrary,
    removePlaylistFromLibrary,
    reorderPlaylistSongs,
    changePlaylistVisibility,
    toggleCollaborative,
    uploadPlaylistCover,
    deletePlaylistCover
}
