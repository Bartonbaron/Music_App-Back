const { models } = require("../models");
const bcrypt = require("bcryptjs");
const extractKey = require("../utils/extractKey");
const { generateSignedUrl } = require("../config/s3");
const { presentUser } = require("../utils/userPresenter");
const User = models.users;
const Role = models.roles;
const Playlist = models.playlists;
const PlaylistSongs = models.playlistsongs;

const { validatePassword } = require("../utils/validatePassword");

const getMyProfile = async (req, res) => {
    try {
        const userID = req.user.id;

        const user = await User.findByPk(userID, {
            attributes: [
                "userID",
                "userName",
                "email",
                "profilePicURL",
                "status",
                "createdAt",
                "volume",
                "playbackMode",
                "autoplay",
            ],
            include: [
                {
                    model: Role,
                    as: "role",
                    attributes: ["roleID", "roleName"],
                },
            ],
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        return res.json({
            message: "User profile fetched successfully",
            user: await presentUser(user),
        });
    } catch (error) {
        console.error("GET MY PROFILE ERROR:", error);
        return res.status(500).json({ message: "Server error during profile fetch" });
    }
};

const getPublicUser = async (req, res) => {
    try {
        const { userID } = req.params;

        const user = await User.findByPk(userID, {
            attributes: ["userID", "userName", "profilePicURL", "createdAt", "status"],
            include: [{ model: Role, as: "role", attributes: ["roleID", "roleName"] }],
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.status === false) {
            return res.status(404).json({ message: "User not found" });
        }

        const presented = await presentUser(user);

        return res.json({
            message: "Public user fetched",
            user: {
                userID: presented.userID,
                userName: presented.userName,
                role: presented.role,
                createdAt: presented.createdAt,
                signedProfilePicURL: presented.signedProfilePicURL,
            },
        });
    } catch (err) {
        console.error("GET PUBLIC USER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { userName, email, profilePicURL } = req.body;

        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const currentUserName = user.userName;
        const currentEmail = user.email;

        if (userName && userName !== currentUserName) {
            const exists = await User.findOne({ where: { userName } });
            if (exists) return res.status(400).json({ message: "Username already taken" });
            user.userName = userName;
        }

        if (email && email !== currentEmail) {
            const exists = await User.findOne({ where: { email } });
            if (exists) return res.status(400).json({ message: "Email already in use" });
            user.email = email;
        }

        if (profilePicURL !== undefined) {
            user.profilePicURL = profilePicURL || null;
        }

        await user.save();

        return res.json({
            message: "Profile updated successfully!",
            user: await presentUser(user),
        });
    } catch (error) {
        console.error("UPDATE ME ERROR:", error);
        return res.status(500).json({ message: "Server error during profile update" });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "Provide old and new passwords" });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                message:
                    "New password must be at least 8 characters long, include one uppercase letter, one number, and one special character (!@#$%^&*)",
            });
        }

        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: "Incorrect old password" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.json({ message: "Password changed successfully!" });
    } catch (error) {
        console.error("CHANGE PASSWORD ERROR:", error);
        return res.status(500).json({ message: "Server error during password change" });
    }
};

const updatePlaybackPreferences = async (req, res) => {
    try {
        const userID = req.user.id;

        const { volume, playbackMode, autoplay } = req.body;

        const updates = {};

        // volume: 0..1
        if (volume !== undefined) {
            const v = Number(volume);
            if (!Number.isFinite(v) || v < 0 || v > 1) {
                return res.status(400).json({ message: "volume must be a number between 0 and 1" });
            }
            updates.volume = v;
        }

        // playbackMode: normal/shuffle/repeat
        if (playbackMode !== undefined) {
            const allowedModes = ["normal", "shuffle", "repeat"];
            if (!allowedModes.includes(playbackMode)) {
                return res.status(400).json({
                    message: `playbackMode must be one of: ${allowedModes.join(", ")}`
                });
            }
            updates.playbackMode = playbackMode;
        }
        
        if (autoplay !== undefined) {
            if (typeof autoplay !== "boolean") {
                return res.status(400).json({ message: "autoplay must be boolean" });
            }
            updates.autoplay = autoplay;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: "No valid fields provided (volume, playbackMode, autoplay)"
            });
        }

        const user = await User.findByPk(userID);
        if (!user) return res.status(404).json({ message: "User not found" });

        await user.update(updates);

        return res.json({
            message: "Preferences updated",
            preferences: {
                volume: user.volume,
                playbackMode: user.playbackMode,
                autoplay: user.autoplay
            }
        });

    } catch (err) {
        console.error("UPDATE PREFERENCES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const getPublicUserPlaylists = async (req, res) => {
    try {
        const { userID } = req.params;

        const playlists = await Playlist.findAll({
            where: {
                userID,
                visibility: "P"
            },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        const result = await Promise.all(
            playlists.map(async (p) => {
                const coverKey = p.coverURL ? extractKey(p.coverURL) : null;

                const songsCount = await PlaylistSongs.count({
                    where: { playlistID: p.playlistID },
                });

                return {
                    playlistID: p.playlistID,
                    playlistName: p.playlistName,
                    description: p.description ?? null,
                    createdAt: p.createdAt,

                    creatorName: p?.user?.userName ?? null,

                    songsCount,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        return res.json(result);
    } catch (err) {
        console.error("GET PUBLIC USER PLAYLISTS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getMyProfile,
    getPublicUser,
    updateProfile,
    changePassword,
    updatePlaybackPreferences,
    getPublicUserPlaylists
};
