const { PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { s3, generateSignedUrl } = require("../config/s3");
const mm = require("music-metadata");

const { models, sequelize } = require("../models");
const Podcast = models.podcasts;
const CreatorProfile = models.creatorprofiles;
const FavoritePodcasts = models.favoritepodcasts;

const BUCKET = process.env.AWS_S3_BUCKET;

const extractKey = (url) =>
    url ? url.split(".amazonaws.com/")[1] : null;

// UPLOAD PODCAST (Tylko twórca)
const uploadPodcast = async (req, res) => {
    try {
        const audio = req.files?.file?.[0];
        const cover = req.files?.cover?.[0];

        if (!audio)
            return res.status(400).json({ message: "Podcast audio is required" });

        const creatorProfile = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creatorProfile)
            return res.status(403).json({ message: "Creator profile not found" });

        // pobranie duration
        let duration = null;
        try {
            const meta = await mm.parseBuffer(audio.buffer);
            duration = Math.round(meta.format.duration);
        } catch {}

        // Wymagane topicID
        if (!req.body.topicID) {
            return res.status(400).json({ message: "topicID is required" });
        }

        // sprawdź czy topic istnieje
        const topic = await models.topics.findByPk(req.body.topicID);
        if (!topic) {
            return res.status(400).json({ message: "Invalid topicID — topic not found" });
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
            message: "Podcast uploaded successfully",
            podcast
        });

    } catch (err) {
        console.error("UPLOAD PODCAST ERROR:", err);
        res.status(500).json({ message: "Upload failed" });
    }
};


// GET ONE PODCAST + CREATOR DETAILS
const getPodcast = async (req, res) => {
    try {
        const podcast = await Podcast.findByPk(req.params.id);
        if (!podcast)
            return res.status(404).json({ message: "Podcast not found" });

        const creator = await CreatorProfile.findOne({
            where: { creatorID: podcast.creatorID },
            attributes: ["creatorID", "userID", "bio", "verified"]
        });

        const audioKey = extractKey(podcast.fileURL);
        const coverKey = extractKey(podcast.coverURL);

        res.json({
            ...podcast.toJSON(),
            creator,
            signedAudio: audioKey ? await generateSignedUrl(audioKey) : null,
            signedCover: coverKey ? await generateSignedUrl(coverKey) : null
        });

    } catch (err) {
        console.error("GET PODCAST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// GET ALL PODCASTS + CREATOR DETAILS
const getAllPodcasts = async (req, res) => {
    try {
        const podcasts = await Podcast.findAll();

        const result = await Promise.all(
            podcasts.map(async (p) => {
                const creator = await CreatorProfile.findOne({
                    where: { creatorID: p.creatorID },
                    attributes: ["creatorID", "userID", "bio", "verified"]
                });

                return {
                    ...p.toJSON(),
                    creator,
                    signedAudio: p.fileURL ? await generateSignedUrl(extractKey(p.fileURL)) : null,
                    signedCover: p.coverURL ? await generateSignedUrl(extractKey(p.coverURL)) : null
                };
            })
        );

        res.json(result);

    } catch (err) {
        console.error("GET PODCAST LIST ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE PODCAST (Tylko twórca)
const deletePodcast = async (req, res) => {
    try {
        const podcast = await Podcast.findByPk(req.params.id);
        if (!podcast)
            return res.status(404).json({ message: "Podcast not found" });

        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator)
            return res.status(403).json({ message: "You are not a creator" });

        if (podcast.creatorID !== creator.creatorID)
            return res.status(403).json({ message: "You can delete only your own podcasts" });

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

        const count = await Podcast.count();
        if (count === 0) {
            await sequelize.query("ALTER TABLE podcasts AUTO_INCREMENT = 1");
        }

        res.json({ message: "Podcast deleted", deletedFiles: objects });

    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.status(500).json({ message: "Delete failed" });
    }
};

const incrementPodcastStream = async (req, res) => {
    try {
        const podcast = await Podcast.findByPk(req.params.id);
        if (!podcast) return res.status(404).json({ message: "Podcast not found" });

        await podcast.increment("streamCount");

        res.json({ message: "Stream count incremented" });
    } catch (err) {
        console.error("STREAM ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const favoritePodcast = async (req, res) => {
    try {
        const userID = req.user.id;
        const podcastID = req.params.id;

        const podcast = await Podcast.findByPk(podcastID);
        if (!podcast) {
            return res.status(404).json({ message: "Podcast not found" });
        }

        // Widoczność
        if (podcast.visibility === "R") {
            const creator = await CreatorProfile.findOne({
                where: { userID }
            });

            if (!creator || creator.creatorID !== podcast.creatorID) {
                return res.status(403).json({
                    message: "This podcast is private"
                });
            }
        }

        const exists = await FavoritePodcasts.findOne({
            where: { userID, podcastID }
        });

        if (exists) {
            return res.status(400).json({ message: "Already in favorites" });
        }

        await FavoritePodcasts.create({ userID, podcastID });

        res.json({ message: "Added to favorites" });

    } catch (err) {
        console.error("FAV ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const unfavoritePodcast = async (req, res) => {
    try {
        const userID = req.user.id;
        const podcastID = req.params.id;

        const row = await FavoritePodcasts.findOne({ where: { userID, podcastID } });
        if (!row) return res.status(400).json({ message: "Not in favorites" });

        await row.destroy();

        res.json({ message: "Removed from favorites" });

    } catch (err) {
        console.error("UNFAV ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const updatePodcastVisibility = async (req, res) => {
    try {
        const { id } = req.params;
        const { visibility } = req.body;

        // Walidacja wartości
        const allowed = ["P", "R", "U"];
        if (!allowed.includes(visibility)) {
            return res.status(400).json({
                message: "Invalid visibility value. Allowed: P, R, U"
            });
        }

        const podcast = await Podcast.findByPk(id);
        if (!podcast) {
            return res.status(404).json({ message: "Podcast not found" });
        }

        // Sprawdź twórcę
        const creator = await CreatorProfile.findOne({
            where: { userID: req.user.id }
        });

        if (!creator) {
            return res.status(403).json({
                message: "You are not a creator — cannot modify podcasts."
            });
        }

        if (podcast.creatorID !== creator.creatorID) {
            return res.status(403).json({
                message: "You can update only your own podcasts"
            });
        }

        // Aktualizacja
        podcast.visibility = visibility;
        await podcast.save();

        res.json({
            message: "Podcast visibility updated",
            podcastID: podcast.podcastID,
            visibility: podcast.visibility
        });

    } catch (err) {
        console.error("UPDATE VISIBILITY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    uploadPodcast,
    getPodcast,
    getAllPodcasts,
    deletePodcast,
    incrementPodcastStream,
    favoritePodcast,
    unfavoritePodcast,
    updatePodcastVisibility
}

