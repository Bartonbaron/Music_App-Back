const { models } = require("../models");
const { Op } = require("sequelize");

const {
    songs: Song,
    albums: Album,
    playlists: Playlist,
    podcasts: Podcast,
    users: User,
    creatorprofiles: CreatorProfile,
    roles: Role
} = models;

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
                creators: []
            });
        }

        const like = `%${q}%`;

        const [
            songs,
            albums,
            playlists,
            podcasts,
            users,
            creators
        ] = await Promise.all([

            Song.findAll({
                where: {
                    songName: { [Op.like]: like },
                    moderationStatus: "ACTIVE"
                },
                limit: 10
            }),

            Album.findAll({
                where: {
                    albumName: { [Op.like]: like },
                    isPublished: true,
                    moderationStatus: "ACTIVE"
                },
                limit: 10
            }),

            Playlist.findAll({
                where: {
                    playlistName: { [Op.like]: like },
                    visibility: "P",
                    moderationStatus: "ACTIVE"
                },
                limit: 10
            }),

            Podcast.findAll({
                where: {
                    podcastName: { [Op.like]: like },
                    visibility: "P",
                    moderationStatus: "ACTIVE"
                },
                limit: 10
            }),

            User.findAll({
                where: {
                    userName: { [Op.like]: like }
                },
                include: [
                    {
                        model: Role,
                        as: "role",
                        where: { roleName: { [Op.ne]: "ADMIN" } },
                        attributes: []
                    }
                ],
                attributes: ["userID", "userName", "profilePicURL"],
                limit: 10
            }),

            CreatorProfile.findAll({
                where: { isActive: true },
                include: [
                    {
                        model: User,
                        as: "user",
                        where: {
                            userName: { [Op.like]: like }
                        },
                        attributes: ["userID", "userName"]
                    }
                ],
                attributes: ["creatorID"],
                limit: 10
            })
        ]);

        res.json({
            songs,
            albums,
            playlists,
            podcasts,
            users,
            creators
        });

    } catch (err) {
        console.error("SEARCH ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {search};
