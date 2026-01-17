const { sequelize, models } = require("../../models");
const {Op} = require("sequelize");
const Creator = models.creatorprofiles;
const User = models.users;
const Song = models.songs;
const Genre = models.genres;
const Followers = models.followers;
const Album = models.albums;
const Podcast = models.podcasts;
const Playlist = models.playlists;
const PlaylistSongs = models.playlistsongs;
require('dotenv').config();

const extractKey = require("../../utils/extractKey");
const { generateSignedUrl } = require("../../config/s3");

// Pobierz profil twórcy
const getCreatorProfile = async (req, res) => {
    try {
        const { id } = req.params;          // creatorID
        const viewerUserID = req.user.id;

        const creator = await Creator.findByPk(id, {
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName", "profilePicURL"],
                },
            ],
        });

        if (!creator || creator.isActive === false) {
            return res.status(404).json({ message: "Nie znaleziono twórcy" });
        }

        // followers
        const followersCount = await Followers.count({ where: { creatorID: id } });
        const isFollowing = await Followers.findOne({
            where: { creatorID: id, userID: viewerUserID },
        });

        // signed avatar
        const signedProfilePicURL = creator.user.profilePicURL
            ? await generateSignedUrl(extractKey(creator.user.profilePicURL))
            : null;

        // songs
        const songs = await Song.findAll({
            where: { creatorID: creator.creatorID },
            attributes: ["songID", "songName", "duration", "coverURL", "fileURL", "createdAt", "moderationStatus"],
            order: [["createdAt", "DESC"]],
        });

        const presentedSongs = await Promise.all(
            songs.map(async (s) => {
                const audioKey = s.fileURL ? extractKey(s.fileURL) : null;
                const coverKey = s.coverURL ? extractKey(s.coverURL) : null;

                return {
                    songID: s.songID,
                    songName: s.songName,
                    duration: s.duration,
                    moderationStatus: s.moderationStatus,
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    createdAt: s.createdAt,
                };
            })
        );

        const albums = await Album.findAll({
            where: { creatorID: creator.creatorID, isPublished: true },
            attributes: ["albumID", "albumName", "coverURL", "createdAt", "moderationStatus"],
            order: [["createdAt", "DESC"]],
        });

        const presentedAlbums = await Promise.all(
            albums.map(async (a) => {
                const coverKey = a.coverURL ? extractKey(a.coverURL) : null;
                return {
                    albumID: a.albumID,
                    albumName: a.albumName,
                    createdAt: a.createdAt,
                    moderationStatus: a.moderationStatus,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        const podcasts = await Podcast.findAll({
            where: { creatorID: creator.creatorID },
            attributes: ["podcastID", "podcastName", "coverURL", "fileURL", "duration", "createdAt", "moderationStatus"],
            order: [["createdAt", "DESC"]],
        });

        const presentedPodcasts = await Promise.all(
            podcasts.map(async (p) => {
                const audioKey = p.fileURL ? extractKey(p.fileURL) : null;
                const coverKey = p.coverURL ? extractKey(p.coverURL) : null;

                return {
                    podcastID: p.podcastID,
                    podcastName: p.podcastName,
                    duration: p.duration ?? null,
                    createdAt: p.createdAt,
                    moderationStatus: p.moderationStatus,

                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    creatorName: creator?.user?.userName ?? null,
                };
            })
        );

        const playlists = await Playlist.findAll({
            where: { userID: creator.userID, visibility: "P" },
            attributes: ["playlistID", "playlistName", "coverURL", "createdAt", "description", "moderationStatus"],
            order: [["createdAt", "DESC"]],
        });

        const presentedPlaylists = await Promise.all(
            playlists.map(async (pl) => {
                const coverKey = pl.coverURL ? extractKey(pl.coverURL) : null;

                const songsCount = await PlaylistSongs.count({
                    where: { playlistID: pl.playlistID },
                });

                return {
                    playlistID: pl.playlistID,
                    playlistName: pl.playlistName,
                    description: pl.description ?? null,
                    createdAt: pl.createdAt,
                    moderationStaus: pl.moderationStatus,
                    songsCount,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        return res.json({
            creatorID: creator.creatorID,
            userID: creator.userID,
            userName: creator.user.userName,
            signedProfilePicURL,
            bio: creator.bio,

            // follow
            followers: followersCount,
            isFollowing: Boolean(isFollowing),

            // content
            songs: presentedSongs,
            albums: presentedAlbums,
            playlists: presentedPlaylists,
            podcasts: presentedPodcasts,
        });
    } catch (err) {
        console.error("GET CREATOR PROFILE ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const getMyCreatorProfile = async (req, res) => {
    try {
        const viewerUserID = req.user.id;

        const creator = await Creator.findOne({
            where: { userID: viewerUserID, isActive: true },
            include: [
                { model: User, as: "user", attributes: ["userID", "userName", "profilePicURL"] },
            ],
        });

        if (!creator) {
            return res.status(404).json({ message: "Nie znaleziono profilu twórcy" });
        }

        const signedProfilePicURL = creator.user?.profilePicURL
            ? await generateSignedUrl(extractKey(creator.user.profilePicURL))
            : null;

        // followers z kolumny + fallback
        const followersFromColumn = Number(creator.numberOfFollowers ?? 0);
        const followers = Number.isFinite(followersFromColumn) ? followersFromColumn : 0;

        // Albums
        const albums = await Album.findAll({
            where: { creatorID: creator.creatorID },
            attributes: ["albumID", "albumName", "coverURL", "createdAt", "moderationStatus"],
            order: [["createdAt", "DESC"]],
        });

        const presentedAlbums = await Promise.all(
            albums.map(async (a) => {
                const coverKey = a.coverURL ? extractKey(a.coverURL) : null;
                return {
                    albumID: a.albumID,
                    albumName: a.albumName,
                    moderationStatus: a.moderationStatus,
                    createdAt: a.createdAt,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        // Songs
        const songs = await Song.findAll({
            where: {
                creatorID: creator.creatorID,
                moderationStatus: { [Op.in]: ["ACTIVE", "HIDDEN"] },
            },
            attributes: [
                "songID",
                "songName",
                "description",
                "genreID",
                "duration",
                "coverURL",
                "fileURL",
                "createdAt",
                "moderationStatus",
            ],
            include: [
                {
                    model: Genre,
                    as: "genre",
                    attributes: ["genreID", "genreName"],
                    required: false,
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        const presentedSongs = await Promise.all(
            songs.map(async (s) => {
                const audioKey = s.fileURL ? extractKey(s.fileURL) : null;
                const coverKey = s.coverURL ? extractKey(s.coverURL) : null;

                const isHidden = s.moderationStatus === "HIDDEN" || !!s.isHidden;

                return {
                    songID: s.songID,
                    songName: s.songName,
                    description: s.description ?? null,
                    duration: s.duration,
                    genreID: s.genreID,
                    genre: s.genre
                        ? { genreID: s.genre.genreID, genreName: s.genre.genreName }
                        : null,

                    moderationStatus: s.moderationStatus,

                    signedAudio: !isHidden && audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    createdAt: s.createdAt,
                };
            })
        );

        // Podcasty
        const podcasts = await Podcast.findAll({
            where: { creatorID: creator.creatorID },
            attributes: ["podcastID", "podcastName", "coverURL", "createdAt", "fileURL", "duration", "moderationStatus"],
            order: [["createdAt", "DESC"]],
        });

        const presentedPodcasts = await Promise.all(
            podcasts.map(async (p) => {
                const coverKey = p.coverURL ? extractKey(p.coverURL) : null;
                const audioKey = p.fileURL ? extractKey(p.fileURL) : null;

                return {
                    podcastID: p.podcastID,
                    podcastName: p.podcastName,
                    duration: p.duration ?? null,
                    moderationStatus: p.moderationStatus,
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    createdAt: p.createdAt,
                };
            })
        );

        const playlists = await Playlist.findAll({
            where: { userID: creator.userID},
            attributes: ["playlistID", "playlistName", "coverURL", "createdAt", "description", "moderationStatus"],
            order: [["createdAt", "DESC"]],
        });

        const presentedPlaylists = await Promise.all(
            playlists.map(async (pl) => {
                const coverKey = pl.coverURL ? extractKey(pl.coverURL) : null;

                const songsCount = await PlaylistSongs.count({
                    where: { playlistID: pl.playlistID },
                });

                return {
                    playlistID: pl.playlistID,
                    playlistName: pl.playlistName,
                    description: pl.description ?? null,
                    createdAt: pl.createdAt,
                    moderationStatus: pl.moderationStatus,
                    songsCount,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        return res.json({
            creatorID: creator.creatorID,
            userID: creator.userID,
            userName: creator.user?.userName,
            signedProfilePicURL,
            bio: creator.bio ?? "",
            followers,
            isFollowing: false,
            albums: presentedAlbums,
            playlists: presentedPlaylists,
            songs: presentedSongs,
            podcasts: presentedPodcasts,
        });
    } catch (err) {
        console.error("GET MY CREATOR PROFILE ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// PATCH /api/creators/me
const updateMyCreatorProfile = async (req, res) => {
    try {
        const viewerUserID = req.user.id;
        const { bio } = req.body;

        const creator = await Creator.findOne({
            where: { userID: viewerUserID, isActive: true },
            include: [{ model: User, as: "user", attributes: ["userID", "userName", "profilePicURL"] }],
        });

        if (!creator) {
            return res.status(404).json({ message: "Nie znaleziono profilu twórcy" });
        }

        if (bio !== undefined) creator.bio = bio;
        await creator.save();

        const signedProfilePicURL = creator.user?.profilePicURL
            ? await generateSignedUrl(extractKey(creator.user.profilePicURL))
            : null;

        const followersFromColumn = Number(creator.numberOfFollowers ?? 0);
        const followers = Number.isFinite(followersFromColumn) ? followersFromColumn : 0;

        return res.json({
            message: "Zaktualizowano profil twórcy",
            creator: {
                creatorID: creator.creatorID,
                userID: creator.userID,
                userName: creator.user?.userName ?? null,
                signedProfilePicURL,
                bio: creator.bio ?? "",
                followers,
            },
        });
    } catch (err) {
        console.error("UPDATE MY CREATOR PROFILE ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// Edytuj profil twórcy (bio)
const updateCreatorProfile = async (req, res) => {
    try {
        const { id } = req.params; // creatorID
        const { bio } = req.body;

        const creator = await Creator.findByPk(id);
        if (!creator) return res.status(404).json({ message: "Nie znaleziono twórcy" });

        // tylko właściciel
        if (String(req.user.id) !== String(creator.userID)) {
            return res.status(403).json({ message: "Brak dostępu" });
        }

        if (bio !== undefined) creator.bio = bio;

        await creator.save();

        return res.json({
            message: "Zaktualizowano profil twórcy",
            creator,
        });
    } catch (err) {
        console.error("UPDATE CREATOR PROFILE ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// Follow/unfollow creator (toggle)
const toggleFollowCreator = async (req, res) => {
    try {
        const { id } = req.params;   // creatorID
        const userID = req.user.id;

        const creator = await Creator.findByPk(id);
        if (!creator || creator.isActive === false) {
            return res.status(404).json({ message: "Nie znaleziono twórcy" });
        }

        if (String(creator.userID) === String(userID)) {
            return res.status(400).json({ message: "Nie możesz obserwować samego siebie" });
        }

        const result = await sequelize.transaction(async (t) => {
            const existing = await Followers.findOne({
                where: { userID, creatorID: id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            let isFollowing;

            if (existing) {
                await existing.destroy({ transaction: t });
                isFollowing = false;

                await Creator.update(
                    { numberOfFollowers: sequelize.literal("GREATEST(numberOfFollowers - 1, 0)") },
                    { where: { creatorID: id }, transaction: t }
                );
            } else {
                await Followers.create({ userID, creatorID: id }, { transaction: t });
                isFollowing = true;

                await Creator.update(
                    { numberOfFollowers: sequelize.literal("numberOfFollowers + 1") },
                    { where: { creatorID: id }, transaction: t }
                );
            }

            const refreshed = await Creator.findByPk(id, { transaction: t });

            return {
                isFollowing,
                followers: Number(refreshed?.numberOfFollowers || 0),
            };
        });

        return res.json({
            message: result.isFollowing ? "Zaobserwowano twórcę" : "Przestano obserwować twórcę",
            isFollowing: result.isFollowing,
            followers: result.followers,
        });
    } catch (err) {
        console.error("TOGGLE FOLLOW CREATOR ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// GET /creators/me/followers/stats
const getMyFollowersStats = async (req, res) => {
    try {
        const userID = Number(req.user?.id ?? req.user?.userID);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const creator = await Creator.findOne({ where: { userID } });
        if (!creator || creator.isActive === false) {
            return res.status(404).json({ message: "Nie znaleziono profilu twórcy" });
        }

        const creatorID = creator.creatorID;

        const now = new Date();
        const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [followersTotal, followersLast7Days, followersLast30Days] = await Promise.all([
            Followers.count({ where: { creatorID } }),
            Followers.count({ where: { creatorID, followedAt: { [Op.gte]: since7 } } }),
            Followers.count({ where: { creatorID, followedAt: { [Op.gte]: since30 } } }),
        ]);

        // seria dzienna z ostatnich 30 dni
        const dailyRaw = await Followers.findAll({
            where: { creatorID, followedAt: { [Op.gte]: since30 } },
            attributes: [
                [sequelize.fn("DATE", sequelize.col("followedAt")), "day"],
                [sequelize.fn("COUNT", sequelize.col("followerID")), "count"],
            ],
            group: [sequelize.fn("DATE", sequelize.col("followedAt"))],
            order: [[sequelize.fn("DATE", sequelize.col("followedAt")), "ASC"]],
            raw: true,
        });

        // map -> {date, count}
        const daily = dailyRaw.map((r) => ({
            date: String(r.day), // "YYYY-MM-DD"
            count: Number(r.count || 0),
        }));

        // informacyjnie porównanie z licznikiem w creatorprofiles
        const cachedCount = Number(creator.numberOfFollowers || 0);

        return res.json({
            creatorID,
            followersTotal,
            followersLast7Days,
            followersLast30Days,
            dailyLast30Days: daily,
            cachedCount,
            cachedDiff: followersTotal - cachedCount,
        });
    } catch (err) {
        console.error("GET FOLLOWERS STATS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getCreatorProfile,
    getMyCreatorProfile,
    updateMyCreatorProfile,
    updateCreatorProfile,
    toggleFollowCreator,
    getMyFollowersStats
}