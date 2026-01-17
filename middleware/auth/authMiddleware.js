const jwt = require('jsonwebtoken');
const {models} = require('../../models');
require('dotenv').config();
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
        return res.status(401).json({ message: "Brak tokena autoryzacyjnego" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT verification error:", err);
            return res.status(403).json({ message: "Nieprawidłowy lub wygasły token" });
        }

        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Brak uwierzytelnienia" });
        }

        const roleId = Number(req.user.roleID);
        if (!Number.isFinite(ADMIN_ROLE_ID) || !Number.isFinite(roleId)) {
            return res.status(500).json({ message: "Błąd konfiguracji ról" });
        }

        if (roleId !== ADMIN_ROLE_ID) {
            return res.status(403).json({ message: "Wymagana rola administratora" });
        }

        next();
    } catch (error) {
        console.error("Admin check error:", error);
        return res.status(500).json({ message: "Błąd serwera podczas weryfikacji uprawnień" });
    }
};

const requireCreator = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Brak uwierzytelnienia" });
        }

        const profile = await models.creatorprofiles.findOne({
            where: {
                userID: req.user.id,
                isActive: true,
            },
        });

        if (!profile) {
            return res.status(403).json({ message: "Wymagane aktywne konto twórcy" });
        }

        req.user.creatorID = profile.creatorID;
        next();
    } catch (error) {
        console.error("Creator check error:", error);
        return res.status(500).json({ message: "Błąd serwera podczas weryfikacji roli twórcy" });
    }
};

module.exports = { authenticateToken, requireAdmin, requireCreator };

