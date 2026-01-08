const { models } = require("../models");

const User = models.users;
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);

const moderateUser = async (req, res) => {
    try {
        const { userID, action } = req.body;

        const targetUserID = Number(userID);
        if (!Number.isFinite(targetUserID) || targetUserID <= 0) {
            return res.status(400).json({ message: "Invalid userID" });
        }

        if (!["DEACTIVATE", "ACTIVATE"].includes(action)) {
            return res.status(400).json({ message: "Invalid action" });
        }

        // Kto wykonuje akcję
        const actingUserID = Number(req.user.userID ?? req.user.id);
        const actingRoleID = Number(req.user.roleID);

        if (!Number.isFinite(actingUserID)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await User.findByPk(targetUserID);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (action === "DEACTIVATE") {
            // Admin nie może zdezaktywować samego siebie
            if (actingRoleID === ADMIN_ROLE_ID && actingUserID === user.userID) {
                return res.status(400).json({
                    message: "Admin nie może zdezaktywować swojego konta",
                });
            }

            user.status = 0;
            await user.save();
        }

        if (action === "ACTIVATE") {
            user.status = 1;
            await user.save();
        }

        return res.json({
            message: "User moderation action applied",
            action,
            userID: user.userID,
            status: user.status,
        });
    } catch (err) {
        console.error("MODERATE USER ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = { moderateUser };