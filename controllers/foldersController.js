const { models } = require("../models");

const Folder = models.folders;
const FolderPlaylists = models.folderplaylists;
const Playlist = models.playlists;

const getFolder = async (req, res) => {
    try {
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Folder not found" });
        }

        res.json(folder);

    } catch (err) {
        console.error("GET FOLDER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};


const getFolders = async (req, res) => {
    try {
        const folders = await Folder.findAll({
            where: { userID: req.user.id },
            order: [["createdAt", "ASC"]]
        });

        res.json(folders);
    } catch (err) {
        console.error("GET FOLDERS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const createFolder = async (req, res) => {
    try {
        const { folderName } = req.body;

        if (!folderName) {
            return res.status(400).json({ message: "folderName is required" });
        }

        const folder = await Folder.create({
            folderName,
            userID: req.user.id
        });

        res.status(201).json({
            message: "Folder created",
            folder
        });
    } catch (err) {
        console.error("CREATE FOLDER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const renameFolder = async (req, res) => {
    try {
        const { folderName } = req.body;
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Folder not found" });
        }

        await folder.update({ folderName });

        res.json({ message: "Folder renamed", folder });
    } catch (err) {
        console.error("RENAME FOLDER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteFolder = async (req, res) => {
    try {
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Folder not found" });
        }

        await folder.destroy(); // CASCADE usunie folderplaylists

        res.json({ message: "Folder deleted" });
    } catch (err) {
        console.error("DELETE FOLDER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getFolderPlaylists = async (req, res) => {
    try {
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Folder not found" });
        }

        const playlists = await FolderPlaylists.findAll({
            where: { folderID: folder.folderID },
            include: [{ model: Playlist, as: "playlist" }]
        });

        res.json(playlists);
    } catch (err) {
        console.error("GET FOLDER PLAYLISTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const addPlaylistToFolder = async (req, res) => {
    try {
        const { playlistID } = req.body;
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Folder not found" });
        }

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist || playlist.userID !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const exists = await FolderPlaylists.findOne({
            where: { folderID: folder.folderID, playlistID }
        });

        if (exists) {
            return res.status(400).json({ message: "Playlist already in folder" });
        }

        await FolderPlaylists.create({
            folderID: folder.folderID,
            playlistID
        });

        res.json({ message: "Playlist added to folder" });
    } catch (err) {
        console.error("ADD PLAYLIST TO FOLDER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const removePlaylistFromFolder = async (req, res) => {
    try {
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Folder not found" });
        }

        await FolderPlaylists.destroy({
            where: {
                folderID: folder.folderID,
                playlistID: req.params.playlistID
            }
        });

        res.json({ message: "Playlist removed from folder" });
    } catch (err) {
        console.error("REMOVE PLAYLIST FROM FOLDER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getFolder,
    getFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    getFolderPlaylists,
    addPlaylistToFolder,
    removePlaylistFromFolder
};
