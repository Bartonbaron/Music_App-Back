const { models } = require("../../models");
const { Op } = require("sequelize");

const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey");

const {
    songs: Song,
    albums: Album,
    playlists: Playlist,
    podcasts: Podcast,
    users: User,
    creatorprofiles: CreatorProfile,
    roles: Role,
} = models;

async function signMaybe(urlOrKey) {
    const key = extractKey(urlOrKey);
    if (!key) return null;
    try {
        return await generateSignedUrl(key);
    } catch (e) {
        return null;
    }
}

const search = async (req, res) => {
    try {
        const q = req.query.q?.trim();
        if (!q || q.length < 2) {
            return res.json({
                songs: [],
                albums: [],
                playlists: [],
                podcasts: [],
                users: [],
                creators: [],
            });
        }

        const like = `%${q}%`;

        const [songs, albums, playlists, podcasts, users, creators] = await Promise.all([
            Song.findAll({
                where: {
                    songName: { [Op.like]: like },
                    moderationStatus: "ACTIVE"
                },
                include: [
                    {
                        model: CreatorProfile,
                        as: "creator",
                        attributes: ["creatorID"],
                        include: [
                            {
                                model: User,
                                as: "user",
                                attributes: ["userID", "userName"]
                            }
                        ]
                    }
                ],
                limit: 10
            }),

            Album.findAll({
                where: {
                    albumName: { [Op.like]: like },
                    isPublished: true,
                    moderationStatus: "ACTIVE",
                },
                include: [
                    {
                        model: CreatorProfile,
                        as: "creator",
                        attributes: ["creatorID"],
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
                limit: 10,
            }),

            Playlist.findAll({
                where: {
                    playlistName: { [Op.like]: like },
                    visibility: "P",
                    moderationStatus: "ACTIVE",
                },
                include: [
                    {
                        model: User,
                        as: "user",
                        attributes: ["userID", "userName", "profilePicURL"],
                        required: false,
                    },
                ],
                limit: 10,
            }),

            Podcast.findAll({
                where: {
                    podcastName: { [Op.like]: like },
                    moderationStatus: "ACTIVE"
                },
                include: [
                    {
                        model: CreatorProfile,
                        as: "creator",
                        attributes: ["creatorID"],
                        include: [
                            {
                                model: User,
                                as: "user",
                                attributes: ["userID", "userName"]
                            }
                        ]
                    }
                ],
                limit: 10
            }),

            User.findAll({
                where: {
                    userName: { [Op.like]: like },
                },
                include: [
                    {
                        model: Role,
                        as: "role",
                        where: { roleName: { [Op.ne]: "ADMIN" } },
                        attributes: [],
                    },
                ],
                attributes: ["userID", "userName", "profilePicURL"],
                limit: 10,
            }),

            CreatorProfile.findAll({
                where: { isActive: true },
                include: [
                    {
                        model: User,
                        as: "user",
                        where: { userName: { [Op.like]: like } },
                        attributes: ["userID", "userName", "profilePicURL"],
                    },
                ],
                attributes: ["creatorID"],
                limit: 10,
            }),
        ]);

        // podpisywanie URL-i (audio + cover + avatar)
        const songsOut = await Promise.all(
            (songs || []).map(async (s) => {
                const j = s.toJSON();
                return {
                    ...j,
                    signedAudio: await signMaybe(j.fileURL),
                    signedCover: await signMaybe(j.coverURL),
                };
            })
        );

        const podcastsOut = await Promise.all(
            (podcasts || []).map(async (p) => {
                const j = p.toJSON();
                return {
                    ...j,
                    signedAudio: await signMaybe(j.fileURL),
                    signedCover: await signMaybe(j.coverURL),
                };
            })
        );

        const albumsOut = await Promise.all(
            (albums || []).map(async (a) => {
                const j = a.toJSON();
                const cu = j.creator?.user || null;

                return {
                    ...j,
                    signedCover: await signMaybe(j.coverURL),
                    creator: j.creator
                        ? {
                            ...j.creator,
                            user: cu
                                ? {
                                    ...cu,
                                    signedProfilePicURL: await signMaybe(cu.profilePicURL),
                                }
                                : null,
                        }
                        : null,
                };
            })
        );

        const playlistsOut = await Promise.all(
            (playlists || []).map(async (pl) => {
                const j = pl.toJSON();
                const u = j.user || null;

                return {
                    ...j,
                    signedCover: await signMaybe(j.coverURL),
                    user: u
                        ? {
                            ...u,
                            signedProfilePicURL: await signMaybe(u.profilePicURL),
                        }
                        : null,
                };
            })
        );

        const usersOut = await Promise.all(
            (users || []).map(async (u) => {
                const j = u.toJSON();
                return {
                    ...j,
                    signedProfilePicURL: await signMaybe(j.profilePicURL),
                };
            })
        );

        const creatorsOut = await Promise.all(
            (creators || []).map(async (c) => {
                const j = c.toJSON();
                const u = j.user || null;
                return {
                    ...j,
                    user: u
                        ? {
                            ...u,
                            signedProfilePicURL: await signMaybe(u.profilePicURL),
                        }
                        : null,
                };
            })
        );

        return res.json({
            songs: songsOut,
            albums: albumsOut,
            playlists: playlistsOut,
            podcasts: podcastsOut,
            users: usersOut,
            creators: creatorsOut,
        });
    } catch (err) {
        console.error("SEARCH ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = { search };