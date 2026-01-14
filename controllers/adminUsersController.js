const { Op } = require("sequelize");
const { models, sequelize } = require("../models");

const User = models.users;
const Role = models.roles;
const Creator = models.creatorprofiles;

const parseIntSafe = (v, fallback = null) => {
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : fallback;
};

const parseLimitOffset = (req) => {
    const limitRaw = parseIntSafe(req.query.limit, 50);
    const offsetRaw = parseIntSafe(req.query.offset, 0);

    const limit = Math.min(Math.max(limitRaw || 50, 1), 200);
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

const promoteToCreator = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const userId = req.params.id;

        const user = await User.findByPk(userId, { transaction });
        if (!user) {
            await transaction.rollback();
            return res.status(404).json({ message: "User not found" });
        }

        // Blokada: nie zmieniaj roli admina i nie zmieniaj siebie
        const adminRole = await Role.findOne({ where: { roleName: "Admin" }, transaction });
        if (adminRole && Number(user.roleID) === Number(adminRole.roleID)) {
            await transaction.rollback();
            return res.status(403).json({ message: "Cannot change role of an Admin" });
        }

        // Blokada na self-change
        const actorId = Number(req.user?.userID ?? req.user?.id);
        if (Number(actorId) === Number(userId)) {
            await transaction.rollback();
            return res.status(403).json({ message: "You cannot change your own role" });
        }

        const creatorRole = await Role.findOne({
            where: { roleName: "Creator" },
            transaction
        });

        if (user.roleID === creatorRole.roleID) {
            await transaction.rollback();
            return res.status(400).json({
                message: "User is already a Creator"
            });
        }

        // Zmiana roli
        user.roleID = creatorRole.roleID;
        await user.save({ transaction });

        const [profile, created] = await Creator.findOrCreate({
            where: { userID: userId },
            defaults: {
                bio: null,
                numberOfFollowers: 0,
                isActive: true
            },
            transaction
        });

        if (!created && profile.isActive === false) {
            profile.isActive = true;
            await profile.save({ transaction });
        }

        await transaction.commit();

        res.json({
            message: "User promoted to Creator",
            userID: userId
        });

    } catch (err) {
        await transaction.rollback();
        console.error("PROMOTE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const demoteCreator = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const userId = req.params.id;

        const user = await User.findByPk(userId, {
            include: { model: Role, as: "role" },
            transaction
        });

        const adminRole = await Role.findOne({ where: { roleName: "Admin" }, transaction });
        if (adminRole && Number(user?.roleID) === Number(adminRole.roleID)) {
            await transaction.rollback();
            return res.status(403).json({ message: "Cannot change role of an Admin" });
        }

        const actorId = Number(req.user?.userID ?? req.user?.id);
        if (Number(actorId) === Number(userId)) {
            await transaction.rollback();
            return res.status(403).json({ message: "You cannot change your own role" });
        }

        if (!user || user.role.roleName !== "Creator") {
            await transaction.rollback();
            return res.status(400).json({
                message: "User is not a Creator"
            });
        }

        const userRole = await Role.findOne({
            where: { roleName: "User" },
            transaction
        });

        // Dezaktywuj twórcę
        const profile = await Creator.findOne({
            where: { userID: userId },
            transaction
        });

        if (profile) {
            profile.isActive = false;
            await profile.save({ transaction });
        }

        // Zmiana roli
        user.roleID = userRole.roleID;
        await user.save({ transaction });

        await transaction.commit();

        res.json({
            message: "Creator demoted (content preserved)",
            userID: userId
        });

    } catch (err) {
        await transaction.rollback();
        console.error("DEMOTE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getAdminUsers,
    getAdminUser,
    promoteToCreator,
    demoteCreator
};