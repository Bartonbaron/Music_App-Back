const { models } = require("../models");
const Library = models.library;
const Playlist = models.playlists;
const Podcast = models.podcasts;
const Song = models.songs;
const LibraryPlaylists = models.libraryplaylists;
const FavoritePodcasts = models.favoritepodcasts;
const FavoriteSongs = models.favoritesongs;

const getLibrary = async (req, res) => {
    try {
        const userID = req.user.id;

        const library = await Library.findOne({
            where: { userID },
            include: [
                {
                    model: LibraryPlaylists,
                    as: "libraryplaylists",
                    include: [{ model: Playlist, as: "playlist" }]
                }
            ]
        });

        if (!library) {
            return res.status(404).json({ message: "Library not found" });
        }

        const favoriteSongs = await FavoriteSongs.findAll({
            where: { userID },
            include: [{ model: Song, as: "song" }],
            order: [["addedAt", "DESC"]]
        });

        const favoritePodcasts = await FavoritePodcasts.findAll({
            where: { userID },
            include: [{ model: Podcast, as: "podcast" }],
            order: [["addedAt", "DESC"]]
        });

        res.json({
            libraryID: library.libraryID,
            playlists: library.libraryplaylists,
            favoriteSongs,
            favoritePodcasts
        });

    } catch (err) {
        console.error("GET LIBRARY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getLibrarySongs = async (req, res) => {
    try {
        const favorites = await FavoriteSongs.findAll({
            where: { userID: req.user.id },
            include: [{ model: Song, as: "song" }],
            order: [["addedAt", "DESC"]]
        });

        res.json(favorites);

    } catch (err) {
        console.error("GET LIBRARY SONGS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getLibraryPodcasts = async (req, res) => {
    try {
        const favorites = await FavoritePodcasts.findAll({
            where: { userID: req.user.id },
            include: [{ model: Podcast, as: "podcast" }],
            order: [["addedAt", "DESC"]]
        });

        res.json(favorites);

    } catch (err) {
        console.error("GET LIBRARY PODCASTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getLibraryPlaylists = async (req, res) => {
    try {
        const library = await Library.findOne({
            where: { userID: req.user.id },
            include: [
                {
                    model: LibraryPlaylists,
                    as: "libraryplaylists",
                    include: [{ model: Playlist, as: "playlist" }]
                }
            ]
        });

        if (!library) {
            return res.status(404).json({ message: "Library not found" });
        }

        res.json(library.libraryplaylists);

    } catch (err) {
        console.error("GET LIBRARY PLAYLISTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getLibrary,
    getLibrarySongs,
    getLibraryPodcasts,
    getLibraryPlaylists
}

