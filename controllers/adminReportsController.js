const { models } = require("../models");

const Report = models.reports;
const User = models.users;
const Song = models.songs;
const Podcast = models.podcasts;
const Playlist = models.playlists;
const Album = models.albums;

// helper do resolve content
const resolveContent = async (report) => {
    switch (report.contentType) {
        case "song":
            return Song.findByPk(report.contentID);
        case "podcast":
            return Podcast.findByPk(report.contentID);
        case "playlist":
            return Playlist.findByPk(report.contentID);
        case "album":
            return Album.findByPk(report.contentID);
        default:
            return null;
    }
};


// GET /admin/reports
const getReports = async (req, res) => {
    try {
        const { status } = req.query;

        const where = {};
        if (status) {
            where.status = status; // pending / reviewed / resolved
        }

        const reports = await Report.findAll({
            where,
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit: 100
        });

        res.json(reports);

    } catch (err) {
        console.error("GET REPORTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
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
            return res.status(404).json({ message: "Report not found" });
        }

        const content = await resolveContent(report);

        res.json({
            ...report.toJSON(),
            content
        });

    } catch (err) {
        console.error("GET REPORT ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// PATCH /admin/reports/:id
const updateReportStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!["pending", "reviewed", "resolved"].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const report = await Report.findByPk(req.params.id);
        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        report.status = status;
        await report.save();

        res.json({
            message: "Report updated",
            reportID: report.reportID,
            status: report.status
        });

    } catch (err) {
        console.error("UPDATE REPORT ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const handleReport = async (req, res) => {
    try {
        const { action } = req.body;

        if (!["HIDE", "UNHIDE", "IGNORE"].includes(action)) {
            return res.status(400).json({ message: "Invalid action" });
        }

        const report = await Report.findByPk(req.params.id);
        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        const content = await resolveContent(report);

        if (!content) {
            report.status = "resolved";
            await report.save();

            return res.json({
                message: "Report resolved, content no longer exists",
                reportID: report.reportID
            });
        }

        // Właściwa akcja
        switch (action) {
            case "HIDE":
                content.moderationStatus = "HIDDEN";
                await content.save();
                break;

            case "UNHIDE":
                content.moderationStatus = "ACTIVE";
                await content.save();
                break;

            case "IGNORE":
                // brak zmian
                break;
        }

        // zawsze resolve report
        report.status = "resolved";
        await report.save();

        res.json({
            message: "Report handled",
            reportID: report.reportID,
            action
        });

    } catch (err) {
        console.error("HANDLE REPORT ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getReports,
    getReport,
    updateReportStatus,
    handleReport
};
