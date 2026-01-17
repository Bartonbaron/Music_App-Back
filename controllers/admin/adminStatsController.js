const { models } = require("../../models");

const {
    users: User,
    creatorprofiles: CreatorProfile,
    songs: Song,
    albums: Album,
    playlists: Playlist,
    podcasts: Podcast,
    playhistory: PlayHistory,
    playqueue: PlayQueue,
    reports: Report
} = models;

const getAdminStats = async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            inactiveUsers,

            totalCreators,
            activeCreators,

            totalSongs,
            hiddenSongs,

            totalAlbums,
            hiddenAlbums,

            totalPlaylists,
            hiddenPlaylists,

            totalPodcasts,
            hiddenPodcasts,

            songStreams,
            podcastStreams,

            historyCount,
            activeQueues,

            pendingReports,
            reviewedReports,
            resolvedReports
        ] = await Promise.all([

            // USERS
            User.count(),
            User.count({ where: { status: true } }),
            User.count({ where: { status: false } }),

            // CREATORS
            CreatorProfile.count(),
            CreatorProfile.count({ where: { isActive: true } }),

            // SONGS
            Song.count(),
            Song.count({ where: { moderationStatus: "HIDDEN" } }),

            // ALBUMS
            Album.count(),
            Album.count({ where: { moderationStatus: "HIDDEN" } }),

            // PLAYLISTS
            Playlist.count(),
            Playlist.count({ where: { moderationStatus: "HIDDEN" } }),

            // PODCASTS
            Podcast.count(),
            Podcast.count({ where: { moderationStatus: "HIDDEN" } }),

            // STREAMS
            Song.sum("streamCount"),
            Podcast.sum("streamCount"),

            // USAGE
            PlayHistory.count(),
            PlayQueue.count(),

            // REPORTS
            Report.count({ where: { status: "pending" } }),
            Report.count({ where: { status: "reviewed" } }),
            Report.count({ where: { status: "resolved" } })
        ]);

        res.json({
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: inactiveUsers,
                creators: {
                    total: totalCreators,
                    active: activeCreators
                }
            },
            content: {
                songs: {
                    total: totalSongs,
                    hidden: hiddenSongs
                },
                albums: {
                    total: totalAlbums,
                    hidden: hiddenAlbums
                },
                playlists: {
                    total: totalPlaylists,
                    hidden: hiddenPlaylists
                },
                podcasts: {
                    total: totalPodcasts,
                    hidden: hiddenPodcasts
                }
            },
            usage: {
                songStreams: songStreams || 0,
                podcastStreams: podcastStreams || 0,
                playHistoryEntries: historyCount,
                activeQueues: activeQueues
            },
            moderation: {
                reports: {
                    pending: pendingReports,
                    reviewed: reviewedReports,
                    resolved: resolvedReports
                }
            }
        });

    } catch (err) {
        console.error("ADMIN STATS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getAdminStats
};
