const { models } = require("../../models");
const { canEditPlaylist } = require("../../utils/playlistPermissions");
const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey");

const Folder = models.folders;
const FolderPlaylists = models.folderplaylists;
const Playlist = models.playlists;

// Helper: podpisz cover playlisty (jeśli jest)
async function signPlaylistCover(playlistJson) {
    try {
        const coverURL = playlistJson?.coverURL || null;
        if (!coverURL) return { ...playlistJson, signedCover: null };

        const key = extractKey(coverURL);
        if (!key) return { ...playlistJson, signedCover: null };

        const signedCover = await generateSignedUrl(key);
        return { ...playlistJson, signedCover };
    } catch (_) {
        return { ...playlistJson, signedCover: null };
    }
}

const getFolder = async (req, res) => {
    try {
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Nie znaleziono folderu" });
        }

        res.json(folder);

    } catch (err) {
        console.error("GET FOLDER ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
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
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const createFolder = async (req, res) => {
    try {
        const { folderName } = req.body;

        if (!folderName) {
            return res.status(400).json({ message: "Pole folderName jest wymagane" });
        }

        const folder = await Folder.create({
            folderName,
            userID: req.user.id
        });

        res.status(201).json({
            message: "Utworzono folder",
            folder
        });
    } catch (err) {
        console.error("CREATE FOLDER ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const renameFolder = async (req, res) => {
    try {
        const { folderName } = req.body;
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Nie znaleziono folderu" });
        }

        await folder.update({ folderName });

        res.json({ message: "Zmieniono nazwę folderu", folder });
    } catch (err) {
        console.error("RENAME FOLDER ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const deleteFolder = async (req, res) => {
    try {
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Nie znaleziono folderu" });
        }

        await folder.destroy();

        res.json({ message: "Usunięto folder" });
    } catch (err) {
        console.error("DELETE FOLDER ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getFolderPlaylists = async (req, res) => {
    try {
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Nie znaleziono folderu" });
        }

        const rows = await FolderPlaylists.findAll({
            where: { folderID: folder.folderID },
            include: [
                {
                    model: Playlist,
                    as: "playlist",
                    attributes: ["playlistID", "playlistName", "coverURL", "userID", "visibility", "createdAt"]
                },
            ],
            order: [
                ["playlistID", "ASC"],
            ],
        });

        const presented = await Promise.all(
            rows.map(async (r) => {
                const rowJson = r.toJSON();

                if (!rowJson.playlist) {
                    return {
                        folderID: rowJson.folderID,
                        playlistID: rowJson.playlistID,
                        playlist: null,
                    };
                }

                const playlistSigned = await signPlaylistCover(rowJson.playlist);

                return {
                    folderID: rowJson.folderID,
                    playlistID: rowJson.playlistID,
                    playlist: playlistSigned,
                };
            })
        );

        return res.json(presented);
    } catch (err) {
        console.error("GET FOLDER PLAYLISTS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const addPlaylistToFolder = async (req, res) => {
    try {
        const { playlistID } = req.body;
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Nie znaleziono folderu" });
        }

        const pid = Number(playlistID);
        if (!Number.isFinite(pid) || pid <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe playlistID" });
        }

        const playlist = await Playlist.findByPk(pid);
        if (!playlist) {
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        // Właściciel albo zaakceptowany współtwórca
        const canEdit = await canEditPlaylist(playlist, req.user.id, models);
        if (!canEdit) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        const exists = await FolderPlaylists.findOne({
            where: { folderID: folder.folderID, playlistID: pid },
        });

        if (exists) {
            return res.status(400).json({ message: "Playlista jest już w folderze" });
        }

        await FolderPlaylists.create({
            folderID: folder.folderID,
            playlistID: pid,
        });

        res.json({ message: "Dodano playlistę do folderu" });
    } catch (err) {
        console.error("ADD PLAYLIST TO FOLDER ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const removePlaylistFromFolder = async (req, res) => {
    try {
        const folder = await Folder.findByPk(req.params.id);

        if (!folder || folder.userID !== req.user.id) {
            return res.status(404).json({ message: "Nie znaleziono folderu" });
        }

        await FolderPlaylists.destroy({
            where: {
                folderID: folder.folderID,
                playlistID: req.params.playlistID
            }
        });

        res.json({ message: "Usunięto playlistę z folderu" });
    } catch (err) {
        console.error("REMOVE PLAYLIST FROM FOLDER ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
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
