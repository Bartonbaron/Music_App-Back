const { sequelize, models } = require("../models");
const Creator = models.creatorprofiles;
const User = models.users;
const Song = models.songs;
const Followers = models.followers;
const Album = models.albums;
const Podcast = models.podcasts;
const Playlist = models.playlists;
const PlaylistSongs = models.playlistsongs;
require('dotenv').config();

const extractKey = require("../utils/extractKey");
const { generateSignedUrl } = require("../config/s3");

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
            return res.status(404).json({ message: "Creator not found" });
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
            attributes: ["songID", "songName", "duration", "coverURL", "fileURL", "createdAt"],
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
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    createdAt: s.createdAt,
                };
            })
        );

        const albums = await Album.findAll({
            where: { creatorID: creator.creatorID, isPublished: true },
            attributes: ["albumID", "albumName", "coverURL", "createdAt"],
            order: [["createdAt", "DESC"]],
        });

        const presentedAlbums = await Promise.all(
            albums.map(async (a) => {
                const coverKey = a.coverURL ? extractKey(a.coverURL) : null;
                return {
                    albumID: a.albumID,
                    albumName: a.albumName,
                    createdAt: a.createdAt,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        const podcasts = await Podcast.findAll({
            where: { creatorID: creator.creatorID },
            attributes: ["podcastID", "podcastName", "coverURL", "fileURL", "duration", "createdAt"],
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

                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    creatorName: creator?.user?.userName ?? null,
                };
            })
        );

        const playlists = await Playlist.findAll({
            where: { userID: creator.userID, visibility: "P" },
            attributes: ["playlistID", "playlistName", "coverURL", "createdAt", "description"],
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
        return res.status(500).json({ message: "Server error" });
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
            return res.status(404).json({ message: "Creator profile not found" });
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
            attributes: ["albumID", "albumName", "coverURL", "createdAt"],
            order: [["createdAt", "DESC"]],
        });

        const presentedAlbums = await Promise.all(
            albums.map(async (a) => {
                const coverKey = a.coverURL ? extractKey(a.coverURL) : null;
                return {
                    albumID: a.albumID,
                    albumName: a.albumName,
                    createdAt: a.createdAt,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        // Songs
        const songs = await Song.findAll({
            where: { creatorID: creator.creatorID },
            attributes: ["songID", "songName", "duration", "coverURL", "fileURL", "createdAt"],
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
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    createdAt: s.createdAt,
                };
            })
        );

        // Podcasty (jak masz)
        const podcasts = await Podcast.findAll({
            where: { creatorID: creator.creatorID },
            attributes: ["podcastID", "podcastName", "coverURL", "createdAt", "fileURL", "duration"],
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
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                    createdAt: p.createdAt,
                };
            })
        );

        const playlists = await Playlist.findAll({
            where: { userID: creator.userID},
            attributes: ["playlistID", "playlistName", "coverURL", "createdAt", "description"],
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
        return res.status(500).json({ message: "Server error" });
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
            return res.status(404).json({ message: "Creator profile not found" });
        }

        if (bio !== undefined) creator.bio = bio;
        await creator.save();

        const signedProfilePicURL = creator.user?.profilePicURL
            ? await generateSignedUrl(extractKey(creator.user.profilePicURL))
            : null;

        const followersFromColumn = Number(creator.numberOfFollowers ?? 0);
        const followers = Number.isFinite(followersFromColumn) ? followersFromColumn : 0;

        return res.json({
            message: "Creator profile updated",
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
        return res.status(500).json({ message: "Server error" });
    }
};

// Edytuj profil twórcy (bio)
const updateCreatorProfile = async (req, res) => {
    try {
        const { id } = req.params; // creatorID
        const { bio } = req.body;

        const creator = await Creator.findByPk(id);
        if (!creator) return res.status(404).json({ message: "Creator not found" });

        // tylko właściciel
        if (String(req.user.id) !== String(creator.userID)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (bio !== undefined) creator.bio = bio;

        await creator.save();

        return res.json({
            message: "Creator profile updated",
            creator,
        });
    } catch (err) {
        console.error("UPDATE CREATOR PROFILE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// Follow/unfollow creator (toggle)
const toggleFollowCreator = async (req, res) => {
    try {
        const { id } = req.params;   // creatorID
        const userID = req.user.id;

        const creator = await Creator.findByPk(id);
        if (!creator || creator.isActive === false) {
            return res.status(404).json({ message: "Creator not found" });
        }

        if (String(creator.userID) === String(userID)) {
            return res.status(400).json({ message: "Cannot follow yourself" });
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
            message: result.isFollowing ? "Followed creator" : "Unfollowed creator",
            isFollowing: result.isFollowing,
            followers: result.followers,
        });
    } catch (err) {
        console.error("TOGGLE FOLLOW CREATOR ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getCreatorProfile,
    getMyCreatorProfile,
    updateMyCreatorProfile,
    updateCreatorProfile,
    toggleFollowCreator
}