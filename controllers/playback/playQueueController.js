const { models, sequelize } = require("../../models");
const { Op } = require("sequelize");
const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey"); // jeśli masz już helper, użyj go

const PlayQueue = models.playqueue;
const Song = models.songs;
const Podcast = models.podcasts;
const CreatorProfile = models.creatorprofiles;
const User = models.users;

const resolveSigned = async (entity, type) => {
    if (!entity) {
        return {
            signedAudio: null,
            signedCover: null,
            moderationStatus: null,
            isHidden: true,
        };
    }

    const status = entity.moderationStatus ?? null;

    const audioKey = entity.fileURL ? extractKey(entity.fileURL) : null;
    const coverKey = entity.coverURL ? extractKey(entity.coverURL) : null;

    const canStream =
        type === "song"
            ? status === "ACTIVE"
            : true;

    const isHidden =
        type === "song"
            ? status === "HIDDEN" || status !== "ACTIVE"
            : false;

    return {
        signedAudio: canStream && audioKey ? await generateSignedUrl(audioKey) : null,
        signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
        moderationStatus: status,
        isHidden,
    };
};

const validateXor = (songID, podcastID) => !(!!songID === !!podcastID);

const normalizeMode = (modeRaw) => {
    const m = String(modeRaw || "END").toUpperCase();
    return m === "NEXT" ? "NEXT" : "END";
};

// GET /queue
const getQueue = async (req, res) => {
    try {
        const userID = req.user.id;

        const items = await PlayQueue.findAll({
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
                            include: [{ model: User, as: "user", required: false, attributes: ["userName"] }],
                        },
                    ],
                },
                {
                    model: Podcast,
                    as: "podcast",
                    required: false,
                    include: [
                        {
                            model: CreatorProfile,
                            as: "creator",
                            required: false,
                            include: [{ model: User, as: "user", required: false, attributes: ["userName"] }],
                        },
                    ],
                },
            ],
            order: [["position", "ASC"]],
        });

        const result = await Promise.all(
            items.map(async (row) => {
                const type = row.songID ? "song" : "podcast";

                if (type === "song") {
                    const s = row.song;
                    const signed = await resolveSigned(s, "song");

                    return {
                        queueID: row.queueID,
                        position: row.position,
                        type,
                        songID: row.songID,
                        title: s?.songName ?? s?.title ?? (s ? `Song ${s.songID}` : "Utwór"),
                        creatorName: s?.creator?.user?.userName ?? s?.creatorName ?? null,
                        song: s ? s.toJSON() : null,
                        podcast: null,
                        ...signed,
                    };
                }

                const p = row.podcast;
                const signed = await resolveSigned(p, "podcast");

                return {
                    queueID: row.queueID,
                    position: row.position,
                    type,
                    podcastID: row.podcastID,
                    title: p?.title ?? p?.podcastName ?? (p ? `Podcast ${p.podcastID}` : "Podcast"),
                    creatorName: p?.creator?.user?.userName ?? p?.creatorName ?? null,
                    song: null,
                    podcast: p ? p.toJSON() : null,
                    ...signed,
                };
            })
        );

        res.json({ count: result.length, items: result });
    } catch (err) {
        console.error("GET QUEUE ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// POST /queue
const addToQueue = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const userID = req.user.id;
        const { songID, podcastID, mode } = req.body || {};

        if (!validateXor(songID, podcastID)) {
            await t.rollback();
            return res.status(400).json({ message: "Podaj dokładnie jedno z pól: songID albo podcastID" });
        }

        const insertMode = normalizeMode(mode);

        // Walidacja istnienia
        if (songID) {
            const song = await Song.findByPk(songID);
            if (!song) {
                await t.rollback();
                return res.status(404).json({ message: "Nie znaleziono utworu" });
            }
        }

        if (podcastID) {
            const podcast = await Podcast.findByPk(podcastID);
            if (!podcast) {
                await t.rollback();
                return res.status(404).json({ message: "Nie znaleziono podcastu" });
            }
        }

        if (insertMode === "NEXT") {
            // przesuń wszystkie pozycje w górę
            await PlayQueue.increment(
                { position: 1 },
                {
                    where: { userID },
                    transaction: t,
                }
            );

            const row = await PlayQueue.create(
                {
                    userID,
                    songID: songID || null,
                    podcastID: podcastID || null,
                    position: 1,
                },
                { transaction: t }
            );

            await t.commit();
            return res.status(201).json({ message: "Dodano do kolejki (następny)", queueID: row.queueID });
        }

        // END
        const lastPos = (await PlayQueue.max("position", { where: { userID }, transaction: t })) || 0;

        const row = await PlayQueue.create(
            {
                userID,
                songID: songID || null,
                podcastID: podcastID || null,
                position: lastPos + 1,
            },
            { transaction: t }
        );

        await t.commit();
        res.status(201).json({ message: "Dodano do kolejki", queueID: row.queueID });
    } catch (err) {
        try { await t.rollback(); } catch (_) {}
        console.error("ADD TO QUEUE ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// DELETE /queue/:id
const removeFromQueue = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const userID = req.user.id;
        const queueID = Number(req.params.id);

        const row = await PlayQueue.findByPk(queueID, { transaction: t });
        if (!row || row.userID !== userID) {
            await t.rollback();
            return res.status(404).json({ message: "Nie znaleziono elementu kolejki" });
        }

        const removedPos = row.position;
        await row.destroy({ transaction: t });

        await PlayQueue.increment(
            { position: -1 },
            {
                where: { userID, position: { [Op.gt]: removedPos } },
                transaction: t,
            }
        );

        await t.commit();
        res.json({ message: "Usunięto z kolejki" });
    } catch (err) {
        try { await t.rollback(); } catch (_) {}
        console.error("REMOVE FROM QUEUE ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// DELETE /queue
const clearQueue = async (req, res) => {
    try {
        const userID = req.user.id;
        await PlayQueue.destroy({ where: { userID } });
        res.json({ message: "Wyczyszczono kolejkę" });
    } catch (err) {
        console.error("CLEAR QUEUE ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// PATCH /queue/reorder body: { order: number[] }
const reorderQueue = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const userID = req.user.id;
        const { order } = req.body || {};

        if (!Array.isArray(order) || order.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: "Pole order musi być niepustą tablicą" });
        }

        const items = await PlayQueue.findAll({
            where: { userID },
            attributes: ["queueID"],
            raw: true,
            transaction: t,
        });

        const currentIDs = items.map((i) => i.queueID);

        if (order.length !== currentIDs.length) {
            await t.rollback();
            return res.status(400).json({ message: "Pole order musi zawierać wszystkie elementy kolejki" });
        }

        const invalid = order.filter((id) => !currentIDs.includes(id));
        if (invalid.length) {
            await t.rollback();
            return res.status(400).json({
                message: "Niektóre elementy kolejki nie należą do Ciebie",
                invalidQueueIDs: invalid,
            });
        }

        // batch update w transakcji
        await Promise.all(
            order.map((id, idx) =>
                PlayQueue.update(
                    { position: idx + 1 },
                    { where: { userID, queueID: id }, transaction: t }
                )
            )
        );

        await t.commit();
        res.json({ message: "Zmieniono kolejność kolejki" });
    } catch (err) {
        try { await t.rollback(); } catch (_) {}
        console.error("REORDER QUEUE ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    reorderQueue,
};