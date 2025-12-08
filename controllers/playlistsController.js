const { models } = require("../models");
const Playlist = models.playlists;

const createPlaylist = async (req, res) => {
    try {
        const { playlistName, description } = req.body;

        if (!playlistName)
            return res.status(400).json({ message: "Playlist name is required" });

        const playlist = await Playlist.create({
            playlistName,
            description: description || null,
            userID: req.user.id,
        });

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

        res.json(playlists);

    } catch (err) {
        console.error("GET MY PLAYLISTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getPlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findByPk(req.params.id);

        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" });

        // prywatna -> tylko właściciel
        if (playlist.visibility === "R" && playlist.userID !== req.user.id) {
            return res.status(403).json({ message: "This playlist is private" });
        }

        res.json(playlist);

    } catch (err) {
        console.error("GET PLAYLIST ERROR:", err);
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
    try {
        const playlist = await Playlist.findByPk(req.params.id);

        if (!playlist)
            return res.status(404).json({ message: "Playlist not found" });

        if (playlist.userID !== req.user.id)
            return res.status(403).json({ message: "You can delete only your own playlists" });

        await playlist.destroy();

        res.json({ message: "Playlist deleted" });

    } catch (err) {
        console.error("DELETE PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createPlaylist,
    getUserPlaylists,
    getPlaylist,
    updatePlaylist,
    deletePlaylist,
}
