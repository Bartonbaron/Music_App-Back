const { models } = require("../models");

const Playlist = models.playlists;
const User = models.users;
const PlaylistCollaborator = models.playlistcollaborators;

const getUserID = (req) => Number(req.user?.userID ?? req.user?.id);

const inviteCollaborator = async (req, res) => {
    try {
        const playlistID = Number(req.params.id);
        const ownerID = getUserID(req);

        const { userID, userName } = req.body;

        if (!Number.isFinite(ownerID)) return res.status(401).json({ message: "Unauthorized" });
        if (!Number.isFinite(playlistID)) return res.status(400).json({ message: "Invalid playlistID" });

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });
        if (Number(playlist.userID) !== ownerID) {
            return res.status(403).json({ message: "Only owner can invite collaborators" });
        }

        if (playlist.isCollaborative !== true) {
            return res.status(400).json({ message: "Enable collaborative mode first" });
        }

        let target = null;
        if (Number.isFinite(Number(userID))) {
            target = await User.findByPk(Number(userID), { attributes: ["userID", "userName"] });
        } else if (typeof userName === "string" && userName.trim()) {
            target = await User.findOne({
                where: { userName: userName.trim() },
                attributes: ["userID", "userName"],
            });
        }

        if (!target) return res.status(404).json({ message: "User not found" });
        if (Number(target.userID) === ownerID) {
            return res.status(400).json({ message: "Owner cannot invite themselves" });
        }

        const [row, created] = await PlaylistCollaborator.findOrCreate({
            where: { playlistID, userID: target.userID },
            defaults: { status: "INVITED" },
        });

        if (!created && row.status === "ACCEPTED") {
            return res.status(409).json({ message: "User is already an accepted collaborator" });
        }

        row.status = "INVITED";
        await row.save();

        return res.status(201).json({
            message: "Invitation sent",
            user: target,
            status: row.status,
        });
    } catch (err) {
        console.error("INVITE COLLAB ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const listCollaborators = async (req, res) => {
    try {
        const playlistID = Number(req.params.id);
        const ownerID = getUserID(req);

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });

        if (Number(playlist.userID) !== ownerID) {
            return res.status(403).json({ message: "Only owner can view collaborators list" });
        }

        const rows = await PlaylistCollaborator.findAll({
            where: { playlistID },
            include: [{ model: User, as: "user", attributes: ["userID", "userName"] }],
            order: [["createdAt", "DESC"]],
        });

        return res.json(rows.map(r => ({
            collaboratorID: r.collaboratorID,
            userID: r.userID,
            status: r.status,
            createdAt: r.createdAt,
            user: r.user,
        })));
    } catch (err) {
        console.error("LIST COLLAB ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const getMyCollabStatus = async (req, res) => {
    try {
        const playlistID = Number(req.params.id);
        const userID = getUserID(req);

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });

        // owner ma status "OWNER"
        if (Number(playlist.userID) === userID) {
            return res.json({ status: "OWNER" });
        }

        const row = await PlaylistCollaborator.findOne({
            where: { playlistID, userID },
        });

        return res.json({ status: row?.status || "NONE" });
    } catch (err) {
        console.error("MY COLLAB STATUS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const respondToInvite = async (req, res) => {
    try {
        const playlistID = Number(req.params.id);
        const userID = getUserID(req);
        const { action } = req.body; // "ACCEPT" | "DECLINE"

        if (!["ACCEPT", "DECLINE"].includes(action)) {
            return res.status(400).json({ message: "Invalid action" });
        }

        const row = await PlaylistCollaborator.findOne({
            where: { playlistID, userID, status: "INVITED" },
        });

        if (!row) return res.status(404).json({ message: "Invite not found" });

        if (action === "DECLINE") {
            await row.destroy();
            return res.json({ message: "Invite declined" });
        }

        row.status = "ACCEPTED";
        await row.save();
        return res.json({ message: "Invite accepted" });
    } catch (err) {
        console.error("RESPOND INVITE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const removeCollaborator = async (req, res) => {
    try {
        const playlistID = Number(req.params.id);
        const ownerID = getUserID(req);
        const targetUserID = Number(req.params.userID);

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Playlist not found" });

        if (Number(playlist.userID) !== ownerID) {
            return res.status(403).json({ message: "Only owner can remove collaborators" });
        }

        const row = await PlaylistCollaborator.findOne({
            where: { playlistID, userID: targetUserID },
        });

        if (!row) return res.status(404).json({ message: "Collaborator not found" });

        await row.destroy();
        return res.json({ message: "Collaborator removed" });
    } catch (err) {
        console.error("REMOVE COLLAB ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    inviteCollaborator,
    listCollaborators,
    getMyCollabStatus,
    respondToInvite,
    removeCollaborator,
};