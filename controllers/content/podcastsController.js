const { PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { s3, generateSignedUrl } = require("../../config/s3");
const mm = require("music-metadata");
const {Op} = require("sequelize");

const { models } = require("../../models");
const Podcast = models.podcasts;
const CreatorProfile = models.creatorprofiles;
const FavoritePodcasts = models.favoritepodcasts;
const StreamHistory = models.streamhistory;
const User = models.users;

const BUCKET = process.env.AWS_S3_BUCKET;

const extractKey = require("../../utils/extractKey");
require("dotenv").config();
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);

const getReqUserID = (req) => Number(req.user?.userID ?? req.user?.id);
const isAdminReq = (req) => Number(req.user?.roleID) === ADMIN_ROLE_ID;

const canSeeHiddenPodcast = async (podcast, req) => {
    if (!podcast) return false;

    // admin zawsze
    if (isAdminReq(req)) return true;

    // 1) jeśli JWT niesie creatorID
    const tokenCreatorID = Number(req.user?.creatorID);
    if (Number.isFinite(tokenCreatorID) && tokenCreatorID > 0) {
        return tokenCreatorID === Number(podcast.creatorID);
    }

    // 2) fallback: po userID -> creatorProfile
    const userID = getReqUserID(req);
    if (!Number.isFinite(userID) || userID <= 0) return false;

    const creator = await CreatorProfile.findOne({
        where: { userID, isActive: true },
        attributes: ["creatorID"],
    });

    if (!creator) return false;
    return Number(creator.creatorID) === Number(podcast.creatorID);
};

// UPLOAD PODCAST (Tylko twórca)
const uploadPodcast = async (req, res) => {
    try {
        const audio = req.files?.file?.[0];
        const cover = req.files?.cover?.[0];

        if (!audio)
            return res.status(400).json({ message: "Plik audio podcastu jest wymagany" });

        const creatorProfile = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creatorProfile)
            return res.status(403).json({ message: "Nie znaleziono profilu twórcy" });

        // pobranie duration
        let duration = null;
        try {
            const meta = await mm.parseBuffer(audio.buffer, audio.mimetype, { duration: true });
            const d = Number(meta?.format?.duration);
            duration = Number.isFinite(d) && d > 0 ? Math.round(d) : null;
        } catch (e) {
            console.warn("PODCAST METADATA ERROR:", e?.message || e);
            duration = null;
        }

        // Wymagane topicID
        if (!req.body.topicID) {
            return res.status(400).json({ message: "Pole topicID jest wymagane" });
        }

        // sprawdź czy topic istnieje
        const topic = await models.topics.findByPk(req.body.topicID);
        if (!topic) {
            return res.status(400).json({ message: "Nieprawidłowe topicID — nie znaleziono tematu" });
        }

        // fileURL może być null
        const podcast = await Podcast.create({
            podcastName: audio.originalname.replace(/\.[^/.]+$/, ""),
            creatorID: creatorProfile.creatorID,
            topicID: req.body.topicID || null,
            description: req.body.description || null,
            releaseDate: req.body.releaseDate || new Date(),
            duration,
            fileURL: null,
            coverURL: null
        });

        const podcastID = podcast.podcastID;

        // upload audio
        const audioKey = `audio/podcasts/${podcastID}.mp3`;

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: audioKey,
            Body: audio.buffer,
            ContentType: audio.mimetype
        }));

        const fileURL = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${audioKey}`;

        // opcjonalna okładka
        let coverURL = null;

        if (cover) {
            const ext = cover.originalname.split(".").pop();
            const coverKey = `covers/podcasts/${podcastID}.${ext}`;

            await s3.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: coverKey,
                Body: cover.buffer,
                ContentType: cover.mimetype
            }));

            coverURL = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${coverKey}`;
        }

        await podcast.update({ fileURL, coverURL });

        res.status(201).json({
            message: "Podcast został przesłany pomyślnie",
            podcast
        });

    } catch (err) {
        console.error("UPLOAD PODCAST ERROR:", err);
        res.status(500).json({ message: "Nie udało się przesłać pliku" });
    }
};

// GET ONE PODCAST + CREATOR DETAILS
const getPodcast = async (req, res) => {
    try {
        const User = models.users;

        const podcastID = Number(req.params.id);
        if (!Number.isFinite(podcastID) || podcastID <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe ID podcastu" });
        }

        const podcast = await Podcast.findByPk(podcastID, {
            include: [
                {
                    model: CreatorProfile,
                    as: "creator",
                    required: false,
                    attributes: ["creatorID", "userID", "bio", "isActive"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            required: false,
                            attributes: ["userID", "userName"],
                        },
                    ],
                },
            ],
        });

        if (!podcast) {
            return res.status(404).json({ message: "Nie znaleziono podcastu" });
        }

        const privileged = await canSeeHiddenPodcast(podcast, req);

        // HIDDEN / nie ACTIVE -> tylko owner/admin
        if (podcast.moderationStatus !== "ACTIVE" && !privileged) {
            return res.status(403).json({ message: "Ten podcast jest niedostępny" });
        }

        const audioKey = podcast.fileURL ? extractKey(podcast.fileURL) : null;
        const coverKey = podcast.coverURL ? extractKey(podcast.coverURL) : null;

        const canStream = true;

        return res.json({
            ...podcast.toJSON(),
            creatorName: podcast?.creator?.user?.userName ?? null,
            duration: podcast.duration,
            signedAudio: canStream && audioKey ? await generateSignedUrl(audioKey) : null,
            signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
        });
    } catch (err) {
        console.error("GET PODCAST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const getMyPodcasts = async (req, res) => {
    try {
        const userID = Number(req.user?.userID ?? req.user?.id);
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        // znajdź aktywny profil twórcy
        const creator = await CreatorProfile.findOne({
            where: { userID, isActive: true },
            attributes: ["creatorID"],
        });

        if (!creator) {
            return res.status(403).json({ message: "Nie znaleziono profilu twórcy" });
        }

        // opcjonalne filtry
        const statusQ = String(req.query.moderationStatus || "").toUpperCase();
        const where = { creatorID: creator.creatorID };

        if (statusQ) {
            if (!["ACTIVE", "HIDDEN"].includes(statusQ)) {
                return res.status(400).json({ message: "Nieprawidłowy moderationStatus" });
            }
            where.moderationStatus = statusQ;
        }

        const limit = Math.min(Number(req.query.limit) || 200, 500);

        const podcasts = await Podcast.findAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
        });

        const result = await Promise.all(
            podcasts.map(async (p) => {
                const audioKey = p.fileURL ? extractKey(p.fileURL) : null;
                const coverKey = p.coverURL ? extractKey(p.coverURL) : null;

                return {
                    ...p.toJSON(),
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        return res.json({ podcasts: result });
    } catch (err) {
        console.error("GET MY PODCASTS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// GET ALL PODCASTS + CREATOR DETAILS
const getAllPodcasts = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "0", 10), 50);

        const podcasts = await Podcast.findAll({
            where: { moderationStatus: "ACTIVE" },
            include: [
                {
                    model: CreatorProfile,
                    as: "creator",
                    attributes: ["creatorID", "userID", "bio"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["userID", "userName"],
                        },
                    ],
                },
            ],
            order: [
                ["releaseDate", "DESC"],
                ["createdAt", "DESC"],
            ],
            ...(limit > 0 ? { limit } : {}),
        });

        const result = await Promise.all(
            podcasts.map(async (p) => {
                const audioKey = p.fileURL ? extractKey(p.fileURL) : null;
                const coverKey = p.coverURL ? extractKey(p.coverURL) : null;

                return {
                    ...p.toJSON(),
                    creatorName: p?.creator?.user?.userName ?? null,
                    signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        return res.json(result);
    } catch (err) {
        console.error("GET PODCAST LIST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const updatePodcast = async (req, res) => {
    try {
        const { id } = req.params;
        const { podcastName, topicID, description, releaseDate } = req.body;
        const coverFile = req.file || null;

        if (!id) return res.status(400).json({ message: "Pole podcastID jest wymagane" });

        const podcast = await Podcast.findByPk(id);
        if (!podcast) return res.status(404).json({ message: "Nie znaleziono podcastu" });

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id, isActive: true },
            attributes: ["creatorID", "userID"],
        });

        if (!creator) {
            return res.status(403).json({ message: "Nie znaleziono profilu twórcy" });
        }

        if (String(podcast.creatorID) !== String(creator.creatorID)) {
            return res.status(403).json({ message: "Brak dostępu" });
        }

        // Update nazwy
        if (podcastName !== undefined) {
            const trimmed = String(podcastName || "").trim();
            if (!trimmed) return res.status(400).json({ message: "podcastName nie może być puste" });
            podcast.podcastName = trimmed;
        }

        // Update tematu
        if (topicID !== undefined) {
            const tid = Number(topicID);
            if (!Number.isFinite(tid) || tid <= 0) {
                return res.status(400).json({ message: "Nieprawidłowe topicID" });
            }

            const topic = await models.topics.findByPk(tid);
            if (!topic) {
                return res.status(400).json({ message: "Nieprawidłowe topicID — nie znaleziono tematu" });
            }

            podcast.topicID = tid;
        }

        // Update description
        if (description !== undefined) {
            const desc = String(description || "").trim();
            podcast.description = desc || null;
        }

        // Update releaseDate
        if (releaseDate !== undefined) {
            const dt = new Date(releaseDate);
            if (Number.isNaN(dt.getTime())) {
                return res.status(400).json({ message: "Nieprawidłowa releaseDate" });
            }
            podcast.releaseDate = dt;
        }

        // upload cover (opcjonalnie)
        if (coverFile) {
            const oldCoverKey = extractKey(podcast.coverURL);

            const ext = (coverFile.originalname || "jpg").split(".").pop();
            const coverKey = `covers/podcasts/${podcast.podcastID}.${ext}`;

            await s3.send(
                new PutObjectCommand({
                    Bucket: BUCKET,
                    Key: coverKey,
                    Body: coverFile.buffer,
                    ContentType: coverFile.mimetype,
                })
            );

            podcast.coverURL = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${coverKey}`;

            if (oldCoverKey && oldCoverKey !== coverKey) {
                try {
                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: BUCKET,
                            Key: oldCoverKey,
                        })
                    );
                } catch (e) {
                    console.warn("DELETE OLD PODCAST COVER WARN:", e?.message || e);
                }
            }
        }

        await podcast.save();

        const signedCover = podcast.coverURL
            ? await generateSignedUrl(extractKey(podcast.coverURL))
            : null;

        return res.json({
            message: "Zaktualizowano podcast",
            podcast: {
                podcastID: podcast.podcastID,
                podcastName: podcast.podcastName,
                topicID: podcast.topicID,
                description: podcast.description ?? null,
                releaseDate: podcast.releaseDate,
                duration: podcast.duration,
                signedCover,
            },
        });
    } catch (err) {
        console.error("UPDATE PODCAST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// DELETE PODCAST (Tylko twórca)
const deletePodcast = async (req, res) => {
    try {
        const podcast = await Podcast.findByPk(req.params.id);
        if (!podcast)
            return res.status(404).json({ message: "Nie znaleziono podcastu" });

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator)
            return res.status(403).json({ message: "Nie jesteś twórcą" });

        if (podcast.creatorID !== creator.creatorID)
            return res.status(403).json({ message: "Możesz usuwać tylko własne podcasty" });

        const audioKey = extractKey(podcast.fileURL);
        const coverKey = extractKey(podcast.coverURL);

        const objects = [];
        if (audioKey) objects.push({ Key: audioKey });
        if (coverKey) objects.push({ Key: coverKey });

        if (objects.length)
            await s3.send(new DeleteObjectsCommand({
                Bucket: BUCKET,
                Delete: { Objects: objects }
            }));

        await podcast.destroy();

        res.json({ message: "Usunięto podcast", deletedFiles: objects });

    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.status(500).json({ message: "Nie udało się usunąć" });
    }
};

const incrementPodcastStream = async (req, res) => {
    try {
        const podcastID = req.params.id;
        const userID = req.user.id;

        const podcast = await Podcast.findByPk(podcastID);
        if (!podcast) {
            return res.status(404).json({ message: "Nie znaleziono podcastu" });
        }

        const recent = await StreamHistory.findOne({
            where: {
                userID,
                targetType: "podcast",
                targetID: podcastID,
                createdAt: {
                    [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });

        if (recent) {
            return res.json({ message: "Odsłuch został już niedawno zliczony" });
        }

        await podcast.increment("streamCount");

        await StreamHistory.create({
            userID,
            targetType: "podcast",
            targetID: podcastID
        });

        res.json({ message: "Zliczono odsłuch" });

    } catch (err) {
        console.error("STREAM ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const favoritePodcast = async (req, res) => {
    try {
        const userID = req.user.id;
        const podcastID = req.params.id;

        const podcast = await Podcast.findByPk(podcastID);
        if (!podcast) {
            return res.status(404).json({ message: "Nie znaleziono podcastu" });
        }

        const exists = await FavoritePodcasts.findOne({
            where: { userID, podcastID }
        });

        if (exists) {
            return res.status(400).json({ message: "Podcast jest już w ulubionych" });
        }

        await FavoritePodcasts.create({ userID, podcastID });

        res.json({ message: "Dodano do ulubionych" });

    } catch (err) {
        console.error("FAV ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const unfavoritePodcast = async (req, res) => {
    try {
        const userID = req.user.id;
        const podcastID = req.params.id;

        const row = await FavoritePodcasts.findOne({ where: { userID, podcastID } });
        if (!row) return res.status(400).json({ message: "Podcast nie jest w ulubionych" });

        await row.destroy();

        res.json({ message: "Usunięto z ulubionych" });

    } catch (err) {
        console.error("UNFAV ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    uploadPodcast,
    getPodcast,
    getMyPodcasts,
    getAllPodcasts,
    updatePodcast,
    deletePodcast,
    incrementPodcastStream,
    favoritePodcast,
    unfavoritePodcast,
}

