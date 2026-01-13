const { models } = require("../models");
const { Op } = require("sequelize");
const { generateSignedUrl } = require("../config/s3");
const extractKey = require("../utils/extractKey"); // <-- ujednolicenie (zamiast lokalnego split)

const PlayHistory = models.playhistory;
const Song = models.songs;
const Podcast = models.podcasts;
const CreatorProfile = models.creatorprofiles;

const getHistory = async (req, res) => {
    try {
        const userID = Number(req.user?.userID ?? req.user?.id);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const User = models.users;

        const items = await PlayHistory.findAll({
            where: { userID },
            include: [
                {
                    model: Song,
                    as: "song",
                    required: false,
                    include: [
                        {
                            model: CreatorProfile,
                            as: "creator",
                            required: false,
                            include: [{ model: User, as: "user", attributes: ["userName"] }],
                        },
                    ],
                },
                { model: Podcast, as: "podcast", required: false },
            ],
            order: [["playedAt", "DESC"]],
            limit: 100,
        });

        const result = await Promise.all(
            items.map(async (i) => {
                if (i.songID && i.song) {
                    const hidden = i.song.moderationStatus === "HIDDEN";

                    return {
                        historyID: i.historyID,
                        type: "song",
                        playedAt: i.playedAt,
                        isHidden: hidden,
                        song: {
                            ...i.song.toJSON(),
                            // signedAudio tylko jeśli nie jest HIDDEN
                            signedAudio:
                                !hidden && i.song.fileURL
                                    ? await generateSignedUrl(extractKey(i.song.fileURL))
                                    : null,
                            signedCover: i.song.coverURL
                                ? await generateSignedUrl(extractKey(i.song.coverURL))
                                : null,
                        },
                    };
                }

                // -------- PODCAST --------
                if (i.podcastID && i.podcast) {
                    const hidden = i.podcast.moderationStatus === "HIDDEN";

                    return {
                        historyID: i.historyID,
                        type: "podcast",
                        playedAt: i.playedAt,
                        isHidden: hidden,
                        podcast: {
                            ...i.podcast.toJSON(),
                            signedAudio:
                                !hidden && i.podcast.fileURL
                                    ? await generateSignedUrl(extractKey(i.podcast.fileURL))
                                    : null,
                            signedCover: i.podcast.coverURL
                                ? await generateSignedUrl(extractKey(i.podcast.coverURL))
                                : null,
                        },
                    };
                }

                return null;
            })
        );

        const filtered = result.filter(Boolean);

        return res.json({
            count: filtered.length,
            items: filtered,
        });
    } catch (err) {
        console.error("GET HISTORY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const addToHistory = async (req, res) => {
    try {
        const userID = Number(req.user?.userID ?? req.user?.id);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { songID, podcastID } = req.body;

        if (!!songID === !!podcastID) {
            return res.status(400).json({ message: "Provide exactly one of songID or podcastID" });
        }

        if (songID) {
            const song = await Song.findByPk(songID);
            if (!song) return res.status(404).json({ message: "Song not found" });

            // (opcjonalnie) jeśli chcesz też blokować dodawanie do historii gdy utwór już HIDDEN:
            // if (song.moderationStatus === "HIDDEN") {
            //   return res.status(403).json({ message: "This song is not available" });
            // }
        }

        if (podcastID) {
            const podcast = await Podcast.findByPk(podcastID);
            if (!podcast) return res.status(404).json({ message: "Podcast not found" });

            if (podcast.moderationStatus === "HIDDEN") {
            return res.status(403).json({ message: "This podcast is not available" });
            }

            if (podcast.visibility === "R") {
                const creator = await CreatorProfile.findOne({ where: { userID } });
                if (!creator || creator.creatorID !== podcast.creatorID) {
                    return res.status(403).json({ message: "You are not allowed to play this podcast" });
                }
            }
        }

        const recent = await PlayHistory.findOne({
            where: {
                userID,
                songID: songID || null,
                podcastID: podcastID || null,
                playedAt: { [Op.gt]: new Date(Date.now() - 5 * 60 * 1000) },
            },
        });

        if (recent) return res.json({ message: "Already added to history recently" });

        await PlayHistory.create({
            userID,
            songID: songID || null,
            podcastID: podcastID || null,
        });

        return res.status(201).json({ message: "Added to play history" });
    } catch (err) {
        console.error("ADD TO HISTORY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const clearHistory = async (req, res) => {
    try {
        const userID = Number(req.user?.userID ?? req.user?.id);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        await PlayHistory.destroy({ where: { userID } });
        return res.json({ message: "Play history cleared" });
    } catch (err) {
        console.error("CLEAR HISTORY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getHistory,
    addToHistory,
    clearHistory,
};