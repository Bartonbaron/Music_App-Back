const { models } = require("../../models");
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
const PlaylistCollaborators = models.playlistcollaborators;

const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey");
const { Op } = require("sequelize");

const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);
const isAdminReq = (req) => Number(req.user?.roleID) === ADMIN_ROLE_ID;

const getReqUserID = (req) => Number(req.user?.userID ?? req.user?.id);

const getReqCreatorID = async (req) => {
    const tokenCreatorID = Number(req.user?.creatorID);
    if (Number.isFinite(tokenCreatorID) && tokenCreatorID > 0) return tokenCreatorID;

    const userID = getReqUserID(req);
    if (!Number.isFinite(userID) || userID <= 0) return null;

    const creator = await CreatorProfile.findOne({ where: { userID }, attributes: ["creatorID"] });
    if (!creator) return null;

    return Number(creator.creatorID);
};

const canSeeUnpublishedOrHiddenAlbum = async (album, req) => {
    if (!album) return false;
    if (isAdminReq(req)) return true;

    const myCreatorID = await getReqCreatorID(req);
    if (!Number.isFinite(myCreatorID) || myCreatorID <= 0) return false;

    return Number(album.creatorID) === Number(myCreatorID);
};

const getLibrary = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

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
            return res.status(404).json({ message: "Nie znaleziono biblioteki" });
        }

        const favoriteSongs = await FavoriteSongs.findAll({
            where: { userID },
            include: [
                {
                    model: Song,
                    as: "song",
                    where: { moderationStatus: "ACTIVE" },
                    required: true,
                },
            ],
            order: [["addedAt", "DESC"]]
        });

        const favoritePodcasts = await FavoritePodcasts.findAll({
            where: { userID },
            include: [
                {
                    model: Podcast,
                    as: "podcast",
                    where: { moderationStatus: "ACTIVE" },
                    required: true,
                },
            ],
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
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getLibrarySongs = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const favorites = await FavoriteSongs.findAll({
            where: { userID },
            include: [
                {
                    model: Song,
                    as: "song",
                    where: { moderationStatus: "ACTIVE" },
                    required: true,
                },
            ],
            order: [["addedAt", "DESC"]]
        });

        res.json(favorites);

    } catch (err) {
        console.error("GET LIBRARY SONGS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getLibraryPodcasts = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const favorites = await FavoritePodcasts.findAll({
            where: { userID },
            include: [
                {
                    model: Podcast,
                    as: "podcast",
                    where: { moderationStatus: "ACTIVE" },
                    required: true,
                },
            ],
            order: [["addedAt", "DESC"]]
        });

        res.json(favorites);

    } catch (err) {
        console.error("GET LIBRARY PODCASTS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getLibraryPlaylists = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

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
            return res.status(404).json({ message: "Nie znaleziono biblioteki" });
        }

        res.json(library.libraryplaylists);

    } catch (err) {
        console.error("GET LIBRARY PLAYLISTS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getLibraryPlaylistsList = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const library = await Library.findOne({ where: { userID } });
        if (!library) return res.status(404).json({ message: "Nie znaleziono biblioteki" });

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

        // 1) wstępny filtr: tylko ACTIVE
        const base = entries
            .map((e) => e.playlist)
            .filter(Boolean)
            .filter((p) => p.moderationStatus === "ACTIVE");

        // 2) visibility: public / owner / ACCEPTED collaborator
        const privateNotOwner = base
            .filter((p) => p.visibility === "R" && Number(p.userID) !== userID)
            .map((p) => Number(p.playlistID))
            .filter((x) => Number.isFinite(x) && x > 0);

        let acceptedSet = new Set();
        if (privateNotOwner.length && PlaylistCollaborators) {
            const rows = await PlaylistCollaborators.findAll({
                where: {
                    userID,
                    status: "ACCEPTED",
                    playlistID: { [Op.in]: privateNotOwner },
                },
                attributes: ["playlistID"],
                raw: true,
            });
            acceptedSet = new Set(rows.map((r) => String(r.playlistID)));
        }

        const visible = base.filter((p) => {
            if (p.visibility === "P") return true;
            if (Number(p.userID) === userID) return true;
            return acceptedSet.has(String(p.playlistID));
        });

        const result = await Promise.all(
            visible.map(async (p) => {
                const coverKey = p.coverURL ? extractKey(p.coverURL) : null;
                return {
                    ...p.toJSON(),
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    creatorName: p.user?.userName ?? null,
                };
            })
        );

        res.json(result);
    } catch (err) {
        console.error("GET LIBRARY PLAYLISTS LIST ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getLibraryAlbums = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const library = await Library.findOne({ where: { userID } });
        if (!library) return res.status(404).json({ message: "Nie znaleziono biblioteki" });

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

        const result = await Promise.all(
            rows
                .filter((r) => !!r.album)
                .map(async (r) => {
                    const album = r.album;
                    const privileged = await canSeeUnpublishedOrHiddenAlbum(album, req);

                    if (!privileged) {
                        if (album.moderationStatus !== "ACTIVE") return null;
                        if (!album.isPublished) return null;
                    }

                    const a = album.toJSON();
                    return {
                        albumID: a.albumID,
                        albumName: a.albumName,
                        signedCover: a.coverURL ? await generateSignedUrl(extractKey(a.coverURL)) : null,
                        creatorName: a?.creator?.user?.userName ?? null,
                        addedAt: r.addedAt,
                    };
                })
        );

        res.json(result.filter(Boolean));
    } catch (err) {
        console.error("GET LIBRARY ALBUMS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getLikedSongsList = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const favorites = await FavoriteSongs.findAll({
            where: { userID },
            include: [
                {
                    model: Song,
                    as: "song",
                    where: { moderationStatus: { [Op.in]: ["ACTIVE", "HIDDEN"] } },
                    required: true,
                    include: [
                        {
                            model: CreatorProfile,
                            as: "creator",
                            include: [{ model: User, as: "user", attributes: ["userID", "userName"] }],
                        },
                        {
                            model: Album,
                            as: "album",
                            attributes: ["albumID", "albumName", "coverURL"],
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

                const isHidden = s.moderationStatus === "HIDDEN";

                const signedAudio =
                    !isHidden && s.fileURL ? await generateSignedUrl(extractKey(s.fileURL)) : null;

                const signedSongCover = s.coverURL ? await generateSignedUrl(extractKey(s.coverURL)) : null;

                const a = s.album || null;
                const signedAlbumCover = a?.coverURL ? await generateSignedUrl(extractKey(a.coverURL)) : null;

                const effectiveCover = signedSongCover || signedAlbumCover || null;

                return {
                    addedAt: f.addedAt,

                    songID: s.songID,
                    songName: s.songName,
                    duration: s.duration,
                    likeCount: s.likeCount ?? 0,
                    creatorName: s?.creator?.user?.userName ?? null,

                    moderationStatus: s.moderationStatus,
                    isHidden,

                    signedAudio,
                    signedCover: signedSongCover,

                    album: a
                        ? {
                            albumID: a.albumID,
                            albumName: a.albumName,
                            signedCover: signedAlbumCover,
                        }
                        : null,

                    effectiveCover,
                };
            })
        );

        return res.json(result.filter(Boolean));
    } catch (err) {
        console.error("GET LIKED SONGS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const getFavoritePodcasts = async (req, res) => {
    try {
        const userID = getReqUserID(req);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const rows = await FavoritePodcasts.findAll({
            where: { userID },
            include: [
                {
                    model: Podcast,
                    as: "podcast",
                    where: { moderationStatus: { [Op.in]: ["ACTIVE", "HIDDEN"] } },
                    required: true,
                    include: [
                        {
                            model: CreatorProfile,
                            as: "creator",
                            attributes: ["creatorID"],
                            include: [
                                {
                                    model: User,
                                    as: "user",
                                    attributes: ["userName"],
                                },
                            ],
                        },
                    ],
                },
            ],
            order: [["addedAt", "DESC"]],
        });

        const result = await Promise.all(
            rows.map(async (row) => {
                const p = row.podcast;
                if (!p) return null;

                const isHidden = p.moderationStatus === "HIDDEN";

                return {
                    podcastID: p.podcastID,
                    title: p.title ?? p.podcastName ?? null,
                    duration: p.duration,
                    creatorName: p?.creator?.user?.userName ?? null,

                    moderationStatus: p.moderationStatus,
                    isHidden,
                    signedAudio: !isHidden && p.fileURL ? await generateSignedUrl(extractKey(p.fileURL)) : null,
                    signedCover: p.coverURL ? await generateSignedUrl(extractKey(p.coverURL)) : null,
                };
            })
        );

        return res.json(result.filter(Boolean));
    } catch (err) {
        console.error("GET FAVORITE PODCASTS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getLibrary,
    getLibrarySongs,
    getLibraryPodcasts,
    getLibraryPlaylists,
    getLibraryPlaylistsList,
    getLibraryAlbums,
    getLikedSongsList,
    getFavoritePodcasts
};