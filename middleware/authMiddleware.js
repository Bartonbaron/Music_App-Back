const jwt = require('jsonwebtoken');
const {models} = require('../models');
require('dotenv').config();
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No authorization token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err);
            return res.status(403).json({ message: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    try {
        if (req.user.roleID !== ADMIN_ROLE_ID) {
            return res.status(403).json({ message: "Admin role required" });
        }

        next();
    } catch (error) {
        console.error("Admin check error:", error);
        res.status(500).json({ message: "Server error while checking admin role" });
    }
};

const requireCreator = async (req, res, next) => {
    try {
        const profile = await models.creatorprofiles.findOne({
            where: {
                userID: req.user.id,
                isActive: true
            }
        });

        if (!profile) {
            return res.status(403).json({
                message: "Active creator account required"
            });
        }

        req.user.creatorID = profile.creatorID;

        next();
    } catch (error) {
        console.error("Creator check error:", error);
        res.status(500).json({
            message: "Server error while checking creator role"
        });
    }
};


module.exports = { authenticateToken, requireAdmin, requireCreator };

