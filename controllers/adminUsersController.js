const { Op } = require("sequelize");
const { models } = require("../models");

const User = models.users;
const Role = models.roles;

const parseIntSafe = (v, fallback = null) => {
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : fallback;
};

const parseLimitOffset = (req) => {
    const limitRaw = parseIntSafe(req.query.limit, 50);
    const offsetRaw = parseIntSafe(req.query.offset, 0);

    const limit = Math.min(Math.max(limitRaw || 50, 1), 200); // 1..200
    const offset = Math.max(offsetRaw || 0, 0);

    return { limit, offset };
};

const normalizeStatusFilter = (status) => {
    // status może być: "active", "inactive", "true", "false", 1/0
    if (status === undefined || status === null || status === "") return null;

    const s = String(status).toLowerCase().trim();
    if (["active", "true", "1"].includes(s)) return true;
    if (["inactive", "false", "0"].includes(s)) return false;

    return "__invalid__";
};

// GET /api/admin/users?query=&status=&roleID=&limit=&offset=
const getAdminUsers = async (req, res) => {
    try {
        const { limit, offset } = parseLimitOffset(req);

        const query = (req.query.query || "").trim();
        const statusFilter = normalizeStatusFilter(req.query.status);
        const roleID = req.query.roleID !== undefined ? parseIntSafe(req.query.roleID, "__invalid__") : null;

        if (statusFilter === "__invalid__") {
            return res.status(400).json({ message: "Invalid status filter" });
        }
        if (roleID === "__invalid__") {
            return res.status(400).json({ message: "Invalid roleID" });
        }

        const where = {};

        if (statusFilter !== null) where.status = statusFilter;
        if (roleID !== null) where.roleID = roleID;

        if (query) {
            const maybeId = parseIntSafe(query, null);

            // email jest nullable -> LIKE na null nic nie da, ale to ok
            where[Op.or] = [
                { userName: { [Op.like]: `%${query}%` } },
                { email: { [Op.like]: `%${query}%` } },
                ...(maybeId !== null ? [{ userID: maybeId }] : [])
            ];
        }

        const { rows, count } = await User.findAndCountAll({
            where,
            attributes: ["userID", "userName", "email", "status", "roleID", "createdAt", "updatedAt"],
            include: [
                {
                    model: Role,
                    as: "role",
                    attributes: ["roleID", "roleName"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        res.json({
            total: count,
            limit,
            offset,
            users: rows
        });
    } catch (err) {
        console.error("GET ADMIN USERS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/admin/users/:id
const getAdminUser = async (req, res) => {
    try {
        const id = parseIntSafe(req.params.id, null);
        if (id === null) {
            return res.status(400).json({ message: "Invalid user id" });
        }

        const user = await User.findByPk(id, {
            attributes: ["userID", "userName", "email", "status", "roleID", "profilePicURL", "createdAt", "updatedAt"],
            include: [
                {
                    model: Role,
                    as: "role",
                    attributes: ["roleID", "roleName"]
                }
            ]
        });

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        console.error("GET ADMIN USER ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getAdminUsers,
    getAdminUser
};