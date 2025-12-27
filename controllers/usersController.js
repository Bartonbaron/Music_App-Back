const { models } = require("../models");

const User = models.users;

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

module.exports = {
    updatePlaybackPreferences
};
