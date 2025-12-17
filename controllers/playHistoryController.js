const { models } = require("../models");
const { Op } = require("sequelize");
const { generateSignedUrl } = require("../config/s3");

const PlayHistory = models.playhistory;
const Song = models.songs;
const Podcast = models.podcasts;
const CreatorProfile = models.creatorprofiles;

const extractKey = (url) => (url ? url.split(".amazonaws.com/")[1] : null);

const getHistory = async (req, res) => {
    try {
        const userID = req.user.id;

        const items = await PlayHistory.findAll({
            where: { userID },
            include: [
                { model: Song, as: "song" },
                { model: Podcast, as: "podcast" }
            ],
            order: [["playedAt", "DESC"]],
            limit: 100
        });

        const result = await Promise.all(
            items.map(async (i) => {
                if (i.songID && i.song) {
                    return {
                        historyID: i.historyID,
                        type: "song",
                        playedAt: i.playedAt,
                        song: {
                            ...i.song.toJSON(),
                            signedAudio: i.song.fileURL
                                ? await generateSignedUrl(extractKey(i.song.fileURL))
                                : null,
                            signedCover: i.song.coverURL
                                ? await generateSignedUrl(extractKey(i.song.coverURL))
                                : null
                        }
                    };
                }

                if (i.podcastID && i.podcast) {
                    return {
                        historyID: i.historyID,
                        type: "podcast",
                        playedAt: i.playedAt,
                        podcast: {
                            ...i.podcast.toJSON(),
                            signedAudio: i.podcast.fileURL
                                ? await generateSignedUrl(extractKey(i.podcast.fileURL))
                                : null,
                            signedCover: i.podcast.coverURL
                                ? await generateSignedUrl(extractKey(i.podcast.coverURL))
                                : null
                        }
                    };
                }

                return null;
            })
        );

        res.json({
            count: result.length,
            items: result.filter(Boolean)
        });

    } catch (err) {
        console.error("GET HISTORY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const addToHistory = async (req, res) => {
    try {
        const userID = req.user.id;
        const { songID, podcastID } = req.body;

        if (!!songID === !!podcastID) {
            return res.status(400).json({
                message: "Provide exactly one of songID or podcastID"
            });
        }

        if (songID) {
            const song = await Song.findByPk(songID);
            if (!song) {
                return res.status(404).json({ message: "Song not found" });
            }

        }

        if (podcastID) {
            const podcast = await Podcast.findByPk(podcastID);
            if (!podcast) {
                return res.status(404).json({ message: "Podcast not found" });
            }

            if (podcast.visibility === "R") {
                const creator = await CreatorProfile.findOne({
                    where: { userID }
                });

                if (!creator || creator.creatorID !== podcast.creatorID) {
                    return res.status(403).json({
                        message: "You are not allowed to play this podcast"
                    });
                }
            }
        }

        // anty-spam historii (5 minut)
        const recent = await PlayHistory.findOne({
            where: {
                userID,
                songID: songID || null,
                podcastID: podcastID || null,
                playedAt: {
                    [Op.gt]: new Date(Date.now() - 5 * 60 * 1000)
                }
            }
        });

        if (recent) {
            return res.json({ message: "Already added to history recently" });
        }

        await PlayHistory.create({
            userID,
            songID: songID || null,
            podcastID: podcastID || null
        });

        res.status(201).json({ message: "Added to play history" });

    } catch (err) {
        console.error("ADD TO HISTORY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const clearHistory = async (req, res) => {
    try {
        const userID = req.user.id;

        await PlayHistory.destroy({
            where: { userID }
        });

        res.json({ message: "Play history cleared" });

    } catch (err) {
        console.error("CLEAR HISTORY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getHistory,
    addToHistory,
    clearHistory
};
