const { models } = require("../models");

const Report = models.reports;
const Song = models.songs;
const Podcast = models.podcasts;
const Playlist = models.playlists;
const Album = models.albums;
const User = models.users;

const resolveModel = (type) => {
    switch (type) {
        case "song": return Song;
        case "podcast": return Podcast;
        case "playlist": return Playlist;
        case "album": return Album;
        case "user": return User;
        default: return null;
    }
};

const isOwnContent = (contentType, content, user) => {
    switch (contentType) {
        case "playlist":
        case "album":
            return content.userID === user.id;

        case "song":
        case "podcast":
            if (!user.creatorID) return false;
            return content.creatorID === user.creatorID;

        case "user":
            return content.userID === user.id;

        default:
            return false;
    }
};

const createReport = async (req, res) => {
    try {
        const { contentType, contentID, reason } = req.body;

        if (!contentType || !contentID || !reason) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const Model = resolveModel(contentType);
        if (!Model) {
            return res.status(400).json({ message: "Invalid contentType" });
        }

        const content = await Model.findByPk(contentID);
        if (!content) {
            return res.status(404).json({ message: "Content not found" });
        }

        if (contentType === "album" && content.isPublished === false) {
            return res.status(400).json({
                message: "This album is not publicly available yet"
            });
        }

        if (isOwnContent(contentType, content, req.user)) {
            return res.status(400).json({
                message: "You cannot report your own content"
            });
        }

        const exists = await Report.findOne({
            where: {
                userID: req.user.id,
                contentType,
                contentID,
                status: "pending"
            }
        });

        if (exists) {
            return res.status(400).json({
                message: "You already reported this content"
            });
        }

        const report = await Report.create({
            userID: req.user.id,
            contentType,
            contentID,
            reason,
            status: "pending"
        });

        res.status(201).json({
            message: "Report submitted",
            reportID: report.reportID
        });

    } catch (err) {
        console.error("CREATE REPORT ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    createReport
};
