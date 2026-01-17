const { Sequelize } = require("sequelize");
const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey");
const { models } = require("../../models");

const Album = models.albums;
const Creator = models.creatorprofiles;
const User = models.users;

const signIfPresent = async (urlOrKey) => {
    if (!urlOrKey) return null;

    const key = extractKey(urlOrKey);

    if (String(key).startsWith("http")) {
        console.error("BAD KEY (looks like URL):", key);
        return null;
    }

    try {
        return await generateSignedUrl(key);
    } catch (e) {
        console.error("SIGN ERROR", e);
        return null;
    }
};

const getHomeFacts = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "3", 10), 10);

        // 1) Album facts
        const randomAlbums = await Album.findAll({
            where: {
                moderationStatus: "ACTIVE",
                isPublished: true,
                description: {
                    [Sequelize.Op.and]: [{ [Sequelize.Op.ne]: null }, { [Sequelize.Op.ne]: "" }],
                },
            },
            include: [
                {
                    model: Creator,
                    as: "creator",
                    required: false,
                    where: { isActive: true },
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["userID", "userName", "profilePicURL"],
                            required: false,
                        },
                    ],
                },
            ],
            order: Sequelize.literal("RAND()"),
            limit,
        });

        // 2) Creator facts
        const randomCreators = await Creator.findAll({
            where: {
                isActive: true,
                bio: {
                    [Sequelize.Op.and]: [{ [Sequelize.Op.ne]: null }, { [Sequelize.Op.ne]: "" }],
                },
            },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName", "profilePicURL"],
                    required: true,
                },
            ],
            order: Sequelize.literal("RAND()"),
            limit,
        });

        const albumFacts = await Promise.all(
            randomAlbums.map(async (a) => {
                const signedCover = await signIfPresent(a.coverURL);

                return {
                    type: "album",
                    id: a.albumID,
                    title: a.albumName,
                    text: a.description,
                    creatorName: a.creator?.user?.userName || null,
                    creatorID: a.creator?.creatorID || null,
                    signedCover,
                };
            })
        );

        const creatorFacts = await Promise.all(
            randomCreators.map(async (c) => {
                const signedProfilePicURL = await signIfPresent(c.user?.profilePicURL);

                return {
                    type: "creator",
                    id: c.creatorID,
                    title: c.user?.userName || "Twórca",
                    text: c.bio,
                    followers: c.numberOfFollowers,
                    signedProfilePicURL,
                };
            })
        );

        const minCreators = 1;

        const creatorsToTake = creatorFacts.length > 0 ? Math.min(minCreators, creatorFacts.length) : 0;
        const albumsToTake = Math.max(0, limit - creatorsToTake);

        const pickRandom = (arr, n) => arr.sort(() => Math.random() - 0.5).slice(0, n);

        const pickedCreators = pickRandom(creatorFacts, creatorsToTake);
        const pickedAlbums = pickRandom(albumFacts, albumsToTake);

        const mixed = [...pickedCreators, ...pickedAlbums]
            .sort(() => Math.random() - 0.5)
            .slice(0, limit);

        return res.json(mixed);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Nie udało się załadować ciekawostek na stronę główną" });
    }
};

module.exports = { getHomeFacts };
