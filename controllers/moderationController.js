const { models } = require("../models");

const User = models.users;

const moderateUser = async (req, res) => {
    try {
        const { userID, action } = req.body;

        const user = await User.findByPk(userID);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        switch (action) {
            case "DEACTIVATE":
                user.status = 0;
                await user.save();
                break;

            case "ACTIVATE":
                user.status = 1;
                await user.save();
                break;

            default:
                return res.status(400).json({ message: "Invalid action" });
        }

        res.json({
            message: "User moderation action applied",
            action,
            userID
        });

    } catch (err) {
        console.error("MODERATE USER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    moderateUser
}


