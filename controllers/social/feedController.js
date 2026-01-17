const { models } = require("../../models");
const { Op } = require("sequelize");

const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey");

const Followers = models.followers;
const Song = models.songs;
const Podcast = models.podcasts;

const Creator = models.creatorprofiles || models.creators
const User = models.users;

// Helpery
const normalizeLimit = (n, def = 50, max = 200) => {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return def;
    return Math.min(x, max);
};

const normalizeDays = (n, def = 30, max = 365) => {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return def;
    return Math.min(x, max);
};

const resolveSigned = async (entity) => {
    if (!entity) return { signedAudio: null, signedCover: null, moderationStatus: "UNKNOWN", isHidden: true };

    const status = entity.moderationStatus || "UNKNOWN";
    const isHidden = status === "HIDDEN";
    const isActive = status === "ACTIVE";

    const canStream = isActive && !isHidden;

    const audioKey = entity.fileURL ? extractKey(entity.fileURL) : null;
    const coverKey = entity.coverURL ? extractKey(entity.coverURL) : null;

    return {
        signedAudio: canStream && audioKey ? await generateSignedUrl(audioKey) : null,
        signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
        moderationStatus: status,
        isHidden: isHidden || !isActive,
    };
};

const pickCreatorName = (entity) => {
    return (
        entity?.creatorName ||
        entity?.creator?.user?.userName ||
        entity?.creator?.userName ||
        null
    );
};

// GET /api/feed
const getFeed = async (req, res) => {
    try {
        const userID = req.user.id;

        const limit = normalizeLimit(req.query.limit, 60, 200);
        const days = normalizeDays(req.query.days, 30, 365);

        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // 1) lista obserwowanych twórców
        const followed = await Followers.findAll({
            where: { userID },
            attributes: ["creatorID"],
            raw: true,
        });

        const creatorIDs = followed.map((x) => Number(x.creatorID)).filter((x) => Number.isFinite(x) && x > 0);

        if (!creatorIDs.length) {
            return res.json({ count: 0, items: [] });
        }

        // 2) pobierz content
        const [songs, podcasts] = await Promise.all([
            Song.findAll({
                where: {
                    creatorID: { [Op.in]: creatorIDs },
                    createdAt: { [Op.gte]: since },
                },
                include: [
                    {
                        model: Creator || models.creatorprofiles,
                        as: "creator",
                        required: false,
                        include: [{ model: User, as: "user", required: false, attributes: ["userName"] }],
                    },
                ],
                order: [["createdAt", "DESC"]],
                limit: limit * 2,
            }),

            Podcast.findAll({
                where: {
                    creatorID: { [Op.in]: creatorIDs },
                    createdAt: { [Op.gte]: since },
                },
                include: [
                    {
                        model: Creator || models.creatorprofiles,
                        as: "creator",
                        required: false,
                        include: [{ model: User, as: "user", required: false, attributes: ["userName"] }],
                    },
                ],
                order: [["createdAt", "DESC"]],
                limit: limit * 2,
            }),
        ]);

        // 3) mapowanie + signed urls
        const mappedSongs = await Promise.all(
            (songs || []).map(async (s) => {
                const signed = await resolveSigned(s);

                return {
                    type: "song",
                    songID: s.songID,
                    title: s.songName || s.title || `Song ${s.songID}`,
                    creatorName: pickCreatorName(s),
                    createdAt: s.createdAt,
                    song: s.toJSON ? s.toJSON() : s,
                    podcast: null,
                    ...signed,
                };
            })
        );

        const mappedPodcasts = await Promise.all(
            (podcasts || []).map(async (p) => {
                const signed = await resolveSigned(p);

                return {
                    type: "podcast",
                    podcastID: p.podcastID,
                    title: p.title || p.podcastName || `Podcast ${p.podcastID}`,
                    creatorName: pickCreatorName(p),
                    createdAt: p.createdAt,
                    song: null,
                    podcast: p.toJSON ? p.toJSON() : p,
                    ...signed,
                };
            })
        );

        // 4) merge + sort + limit
        const merged = [...mappedSongs, ...mappedPodcasts]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);

        return res.json({ count: merged.length, items: merged });
    } catch (err) {
        console.error("GET FEED ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getFeed
};