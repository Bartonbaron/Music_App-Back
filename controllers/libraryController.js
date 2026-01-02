const { models } = require("../models");
const Library = models.library;
const Playlist = models.playlists;
const Podcast = models.podcasts;
const Song = models.songs;
const Album = models.albums;
const User = models.users;
const CreatorProfile = models.creatorprofiles;
const LibraryAlbums = models.libraryalbums;
const LibraryPlaylists = models.libraryplaylists;
const FavoritePodcasts = models.favoritepodcasts;
const FavoriteSongs = models.favoritesongs;

const { generateSignedUrl } = require("../config/s3");
const extractKey = require("../utils/extractKey");

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

// Zwraca jak dane mają wyglądać w UI
const getLibraryPlaylistsList = async (req, res) => {
    try {
        const userID = req.user.id;

        const library = await Library.findOne({ where: { userID } });
        if (!library) return res.status(404).json({ message: "Library not found" });

        const entries = await LibraryPlaylists.findAll({
            where: { libraryID: library.libraryID },
            include: [
                {
                    model: Playlist,
                    as: "playlist",
                    include: [{ model: User, as: "user", attributes: ["userID", "userName"] }],
                },
            ],
            order: [["addedAt", "DESC"]],
        });

        // flatten + podpis okładki
        const result = await Promise.all(
            entries.map(async (e) => {
                const p = e.playlist;
                if (!p) return null;

                const coverKey = p.coverURL ? extractKey(p.coverURL) : null;

                return {
                    ...p.toJSON(),
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    creatorName: p.user?.userName ?? null, // pomocne w UI
                };
            })
        );

        res.json(result.filter(Boolean));
    } catch (err) {
        console.error("GET LIBRARY PLAYLISTS LIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getLibraryAlbums = async (req, res) => {
    try {
        const userID = req.user.id;

        // znajdź bibliotekę użytkownika
        const library = await Library.findOne({ where: { userID } });
        if (!library) return res.status(404).json({ message: "Library not found" });

        // pobierz albumy z join-table
        const rows = await LibraryAlbums.findAll({
            where: { libraryID: library.libraryID },
            include: [
                {
                    model: Album,
                    as: "album",
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
                },
            ],
            order: [["addedAt", "DESC"]],
        });

        // mapowanie na prosty payload dla frontu (sidebar)
        const result = await Promise.all(
            rows
                .filter((r) => !!r.album)
                .map(async (r) => {
                    const a = r.album.toJSON();

                    return {
                        albumID: a.albumID,
                        albumName: a.albumName,
                        signedCover: a.coverURL ? await generateSignedUrl(extractKey(a.coverURL)) : null,
                        creatorName: a?.creator?.user?.userName ?? null,
                        addedAt: r.addedAt,
                    };
                })
        );

        res.json(result);
    } catch (err) {
        console.error("GET LIBRARY ALBUMS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getLikedSongsList = async (req, res) => {
    try {
        const userID = req.user.id;

        const favorites = await FavoriteSongs.findAll({
            where: { userID },
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
            order: [["addedAt", "DESC"]],
        });

        const result = await Promise.all(
            favorites.map(async (f) => {
                const s = f.song;
                if (!s) return null;

                return {
                    addedAt: f.addedAt,
                    songID: s.songID,
                    songName: s.songName,
                    duration: s.duration,
                    likeCount: s.likeCount ?? 0,

                    creatorName: s?.creator?.user?.userName ?? null,

                    signedAudio: s.fileURL ? await generateSignedUrl(extractKey(s.fileURL)) : null,
                    signedCover: s.coverURL ? await generateSignedUrl(extractKey(s.coverURL)) : null,
                };
            })
        );

        res.json(result.filter(Boolean));
    } catch (err) {
        console.error("GET LIKED SONGS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getLibrary,
    getLibrarySongs,
    getLibraryPodcasts,
    getLibraryPlaylists,
    getLibraryPlaylistsList,
    getLibraryAlbums,
    getLikedSongsList
}

