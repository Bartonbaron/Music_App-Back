const { models } = require("../models");
const { Op } = require("sequelize");
const { generateSignedUrl } = require("../config/s3");

const PlayQueue = models.playqueue;
const Song = models.songs;
const Podcast = models.podcasts;
const CreatorProfile = models.creatorprofiles;

const extractKey = (url) => (url ? url.split(".amazonaws.com/")[1] : null);

const resolveSigned = async (item, type) => {
    if (type === "song" && item?.song) {
        const audioKey = extractKey(item.song.fileURL);
        const coverKey = extractKey(item.song.coverURL);

        return {
            signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
            signedCover: coverKey ? await generateSignedUrl(coverKey) : null
        };
    }

    if (type === "podcast" && item?.podcast) {
        const audioKey = extractKey(item.podcast.fileURL);
        const coverKey = extractKey(item.podcast.coverURL);

        return {
            signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
            signedCover: coverKey ? await generateSignedUrl(coverKey) : null
        };
    }

    return { signedAudio: null, signedCover: null };
};

const validateXor = (songID, podcastID) => {
    return !(!!songID === !!podcastID);
};

// GET /queue
const getQueue = async (req, res) => {
    try {
        const userID = req.user.id;

        const items = await PlayQueue.findAll({
            where: { userID },
            include: [
                { model: Song, as: "song" },
                { model: Podcast, as: "podcast" }
            ],
            order: [["position", "ASC"]]
        });

        const result = await Promise.all(
            items.map(async (i) => {
                const type = i.songID ? "song" : "podcast";
                const signed = await resolveSigned(i, type);

                return {
                    queueID: i.queueID,
                    position: i.position,
                    type,
                    song: i.songID ? i.song : null,
                    podcast: i.podcastID ? i.podcast : null,
                    ...signed
                };
            })
        );

        res.json({ count: result.length, items: result });
    } catch (err) {
        console.error("GET QUEUE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /queue
const addToQueue = async (req, res) => {
    try {
        const userID = req.user.id;
        const { songID, podcastID } = req.body;

        if (!validateXor(songID, podcastID)) {
            return res.status(400).json({
                message: "Provide exactly one of songID or podcastID"
            });
        }

        // Walidacja istnienia i dostępu
        if (songID) {
            const song = await Song.findByPk(songID);
            if (!song) return res.status(404).json({ message: "Song not found" });
        }

        if (podcastID) {
            const podcast = await Podcast.findByPk(podcastID);
            if (!podcast) return res.status(404).json({ message: "Podcast not found" });

            // Restricted podcast -> tylko twórca
            if (podcast.visibility === "R") {
                const creator = await CreatorProfile.findOne({ where: { userID } });
                if (!creator || creator.creatorID !== podcast.creatorID) {
                    return res.status(403).json({ message: "Podcast is restricted" });
                }
            }
        }

        const lastPos =
            (await PlayQueue.max("position", { where: { userID } })) || 0;

        const row = await PlayQueue.create({
            userID,
            songID: songID || null,
            podcastID: podcastID || null,
            position: lastPos + 1
        });

        res.status(201).json({ message: "Added to queue", queueID: row.queueID });
    } catch (err) {
        console.error("ADD TO QUEUE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /queue/:id
const removeFromQueue = async (req, res) => {
    try {
        const userID = req.user.id;
        const queueID = req.params.id;

        const row = await PlayQueue.findByPk(queueID);
        if (!row || row.userID !== userID) {
            return res.status(404).json({ message: "Queue item not found" });
        }

        const removedPos = row.position;
        await row.destroy();

        // przesuń pozycje w dół
        await PlayQueue.increment(
            { position: -1 },
            {
                where: {
                    userID,
                    position: { [Op.gt]: removedPos }
                }
            }
        );

        res.json({ message: "Removed from queue" });
    } catch (err) {
        console.error("REMOVE FROM QUEUE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /queue
const clearQueue = async (req, res) => {
    try {
        const userID = req.user.id;

        await PlayQueue.destroy({ where: { userID } });

        res.json({ message: "Queue cleared" });
    } catch (err) {
        console.error("CLEAR QUEUE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /queue/reorder
const reorderQueue = async (req, res) => {
    try {
        const userID = req.user.id;
        const { order } = req.body;

        if (!Array.isArray(order) || order.length === 0) {
            return res.status(400).json({ message: "order must be a non-empty array" });
        }

        const items = await PlayQueue.findAll({
            where: { userID },
            attributes: ["queueID"],
            raw: true
        });

        const currentIDs = items.map((i) => i.queueID);

        if (order.length !== currentIDs.length) {
            return res.status(400).json({
                message: "Order must include all items in queue"
            });
        }

        const invalid = order.filter((id) => !currentIDs.includes(id));
        if (invalid.length) {
            return res.status(400).json({
                message: "Some queue items do not belong to you",
                invalidQueueIDs: invalid
            });
        }

        // update pozycji
        for (let i = 0; i < order.length; i++) {
            await PlayQueue.update(
                { position: i + 1 },
                { where: { userID, queueID: order[i] } }
            );
        }

        res.json({ message: "Queue reordered" });
    } catch (err) {
        console.error("REORDER QUEUE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    reorderQueue
};
