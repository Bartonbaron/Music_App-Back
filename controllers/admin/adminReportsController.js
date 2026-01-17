const { models, sequelize } = require("../../models");

const Report = models.reports;
const User = models.users;
const Song = models.songs;
const Podcast = models.podcasts;
const Playlist = models.playlists;
const Album = models.albums;

// helper do resolve content
const resolveContent = async (report, opts = {}) => {
    const findOpts = {};
    if (opts.transaction) findOpts.transaction = opts.transaction;

    switch (report.contentType) {
        case "song":
            return Song.findByPk(report.contentID, findOpts);

        case "podcast":
            return Podcast.findByPk(report.contentID, findOpts);

        case "playlist":
            return Playlist.findByPk(report.contentID, findOpts);

        case "album":
            return Album.findByPk(report.contentID, findOpts);

        case "user":
            return User.findByPk(report.contentID, {
                ...findOpts,
                attributes: ["userID", "userName", "email", "status", "roleID", "createdAt"],
            });

        default:
            return null;
    }
};

// GET /admin/reports
const getReports = async (req, res) => {
    try {
        const { status, contentType, userID, limit = 50, offset = 0 } = req.query;

        const where = {};
        if (status) where.status = status;
        if (contentType) where.contentType = contentType;
        if (userID) where.userID = Number(userID);

        const safeLimit = Math.min(Number(limit) || 50, 200);
        const safeOffset = Number(offset) || 0;

        const { rows, count } = await Report.findAndCountAll({
            where,
            include: [{ model: User, as: "user", attributes: ["userID", "userName"] }],
            order: [["createdAt", "DESC"]],
            limit: safeLimit,
            offset: safeOffset
        });

        res.json({ total: count, limit: safeLimit, offset: safeOffset, reports: rows });
    } catch (err) {
        console.error("GET REPORTS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// GET /admin/reports/:id
const getReport = async (req, res) => {
    try {
        const report = await Report.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName"]
                }
            ]
        });

        if (!report) {
            return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
        }

        const content = await resolveContent(report);

        res.json({
            ...report.toJSON(),
            content
        });

    } catch (err) {
        console.error("GET REPORT ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// PATCH /admin/reports/:id
const updateReportStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!["pending", "reviewed", "resolved"].includes(status)) {
            return res.status(400).json({ message: "Nieprawidłowa wartość statusu" });
        }

        const report = await Report.findByPk(req.params.id);
        if (!report) {
            return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
        }

        report.status = status;
        await report.save();

        res.json({
            message: "Zaktualizowano zgłoszenie",
            reportID: report.reportID,
            status: report.status
        });

    } catch (err) {
        console.error("UPDATE REPORT ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const handleReport = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const actionRaw = req.body?.action;
        const action = String(actionRaw || "").toUpperCase();

        const allowedActions = new Set(["REVIEW", "HIDE", "UNHIDE", "IGNORE"]);
        if (!allowedActions.has(action)) {
            await t.rollback();
            return res.status(400).json({ message: "Nieprawidłowa akcja" });
        }

        const report = await Report.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!report) {
            await t.rollback();
            return res.status(404).json({ message: "Nie znaleziono zgłoszenia" });
        }

        if (action === "REVIEW") {
            if (report.status === "pending") {
                report.status = "reviewed";
                await report.save({ transaction: t });
            }
            await t.commit();
            return res.json({
                message: "Oznaczono zgłoszenie jako przejrzane",
                reportID: report.reportID,
                status: report.status,
            });
        }

        const content = await resolveContent(report, { transaction: t });

        // jeśli treść nie istnieje, resolve report i kończ
        if (!content) {
            report.status = "resolved";
            await report.save({ transaction: t });
            await t.commit();

            return res.json({
                message: "Zgłoszenie zamknięte — treść już nie istnieje",
                reportID: report.reportID,
                action,
            });
        }

        // Właściwa akcja moderacyjna
        if (action !== "IGNORE") {
            if (report.contentType === "user") {
                // moderacja usera: HIDE=deactivate, UNHIDE=activate
                if (action === "HIDE") content.status = 0;
                if (action === "UNHIDE") content.status = 1;
                await content.save({ transaction: t });
            } else {
                // moderacja treści
                if (!("moderationStatus" in content)) {
                    await t.rollback();
                    return res.status(500).json({
                        message: `Typ treści '${report.contentType}' nie obsługuje moderationStatus`,
                    });
                }

                if (action === "HIDE") content.moderationStatus = "HIDDEN";
                if (action === "UNHIDE") content.moderationStatus = "ACTIVE";
                await content.save({ transaction: t });
            }
        }

        // zawsze resolve report
        report.status = "resolved";
        await report.save({ transaction: t });

        await t.commit();

        return res.json({
            message: "Zgłoszenie zostało obsłużone",
            reportID: report.reportID,
            action,
            contentType: report.contentType,
            contentID: report.contentID,
            status: report.status,
        });
    } catch (err) {
        console.error("HANDLE REPORT ERROR:", err);
        try { await t.rollback(); } catch (_) {}
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getReports,
    getReport,
    updateReportStatus,
    handleReport
};