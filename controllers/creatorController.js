const { models } = require("../models");
const Creator = models.creatorprofiles;
const User = models.users;
const Song = models.songs;
const Followers = models.followers;

// Pobierz profil twórcy
const getCreatorProfile = async (req, res) => {
    try {
        const { id } = req.params;

        const creator = await Creator.findByPk(id, {
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName", "profilePicURL"]
                }
            ]
        });

        if (!creator)
            return res.status(404).json({ message: "Creator not found" });

        // pobierz utwory twórcy
        const songs = await Song.findAll({
            where: { creatorID: creator.userID },
            attributes: ["songID", "songName", "duration", "coverURL", "fileURL"]
        });

        // liczba obserwujących z tabeli followers
        const followersCount = await Followers.count({
            where: { creatorID: id }
        });

        res.json({
            creatorID: creator.creatorID,
            userID: creator.userID,
            userName: creator.user.userName,
            avatarURL: creator.user.profilePicURL,
            bio: creator.bio,
            verified: creator.verified === "Y",
            followers: followersCount,
            songs
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// Edytuj profil twórcy (bio)
const updateCreatorProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { bio } = req.body;

        const creator = await Creator.findByPk(id);

        if (!creator)
            return res.status(404).json({ message: "Creator not found" });

        // tylko właściciel lub admin
        if (req.user.id !== creator.userID && req.user.role !== "Administrator") {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (bio !== undefined) creator.bio = bio;

        await creator.save();

        res.json({
            message: "Creator profile updated",
            creator
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};


// Follow creator
const followCreator = async (req, res) => {
    try {
        const { id } = req.params;   // creatorID
        const userID = req.user.id;  // userID

        const creator = await Creator.findByPk(id);
        if (!creator) return res.status(404).json({ message: "Creator not found" });

        // nie można followować samego siebie
        if (creator.userID === userID)
            return res.status(400).json({ message: "Cannot follow yourself" });

        // czy już followuje?
        const exists = await Followers.findOne({
            where: { userID, creatorID: id }
        });

        if (exists)
            return res.status(400).json({ message: "Already following" });

        await Followers.create({ userID, creatorID: id });

        const count = await Followers.count({ where: { creatorID: id } });

        res.json({
            message: "Followed creator",
            followers: count
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};


// Unfollow creator
const unfollowCreator = async (req, res) => {
    try {
        const { id } = req.params;   // creatorID
        const userID = req.user.id;

        const follow = await Followers.findOne({
            where: { userID, creatorID: id }
        });

        if (!follow)
            return res.status(400).json({ message: "Not following this creator" });

        await follow.destroy();

        const count = await Followers.count({ where: { creatorID: id } });

        res.json({
            message: "Unfollowed creator",
            followers: count
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getCreatorProfile,
    updateCreatorProfile,
    followCreator,
    unfollowCreator
}