const { models } = require("../../models");

const Report = models.reports;
const Song = models.songs;
const Podcast = models.podcasts;
const Playlist = models.playlists;
const Album = models.albums;
const User = models.users;

const ALLOWED_TYPES = ["song", "podcast", "playlist", "album", "user"];
const MAX_REASON_LEN = 255;

const resolveModel = (type) => {
    switch (type) {
        case "song": return Song;
        case "podcast": return Podcast;
        case "playlist": return Playlist;
        case "album": return Album;
        case "user": return User;
        default: return null;
    }
};

const getActor = (req) => {
    const userID = Number(req.user?.userID ?? req.user?.id);
    const creatorID = req.user?.creatorID != null ? Number(req.user.creatorID) : null;
    return { userID, creatorID };
};

const isOwnContent = (contentType, content, actor) => {
    switch (contentType) {
        case "playlist":
        case "album":
            return Number(content.userID) === actor.userID;

        case "song":
        case "podcast":
            // Jeśli user nie ma creatorID w tokenie, nie uznajemy tego za "own content"
            if (!Number.isFinite(actor.creatorID)) return false;
            return Number(content.creatorID) === actor.creatorID;

        case "user":
            return Number(content.userID) === actor.userID;

        default:
            return false;
    }
};

const createReport = async (req, res) => {
    try {
        const { contentType, contentID, reason } = req.body;

        // actor
        const actor = getActor(req);
        if (!Number.isFinite(actor.userID) || actor.userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        // walidacja typu
        if (!ALLOWED_TYPES.includes(contentType)) {
            return res.status(400).json({ message: "Nieprawidłowy contentType" });
        }

        // walidacja contentID
        const cid = Number(contentID);
        if (!Number.isFinite(cid) || cid <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe contentID" });
        }

        if (contentType === "user" && Number(cid) === Number(actor.userID)) {
            return res.status(400).json({ message: "Nie możesz zgłosić samego siebie" });
        }

        // walidacja powodu
        const cleanedReason = typeof reason === "string" ? reason.trim() : "";
        if (!cleanedReason) {
            return res.status(400).json({ message: "Powód jest wymagany" });
        }
        if (cleanedReason.length > MAX_REASON_LEN) {
            return res.status(400).json({ message: `Powód jest za długi (maks. ${MAX_REASON_LEN})` });
        }

        const Model = resolveModel(contentType);
        if (!Model) {
            return res.status(400).json({ message: "Nieprawidłowy contentType" });
        }

        const content = await Model.findByPk(cid);
        if (!content) {
            return res.status(404).json({ message: "Nie znaleziono treści" });
        }

        // album niewydany – nie raportujemy
        if (contentType === "album" && content.isPublished === false) {
            return res.status(400).json({ message: "Ten album nie jest jeszcze publicznie dostępny" });
        }

        // nie pozwalaj zgłaszać własnych treści
        if (isOwnContent(contentType, content, actor)) {
            return res.status(400).json({ message: "Nie możesz zgłosić własnych treści" });
        }

        // anty-spam: blokuj powtórki jeśli report jest pending albo reviewed
        const exists = await Report.findOne({
            where: {
                userID: actor.userID,
                contentType,
                contentID: cid,
                status: ["pending", "reviewed"],
            },
        });

        if (exists) {
            return res.status(409).json({ message: "Już zgłosiłeś(-aś) tę treść" });
        }

        const report = await Report.create({
            userID: actor.userID,
            contentType,
            contentID: cid,
            reason: cleanedReason,
            status: "pending",
        });

        return res.status(201).json({
            message: "Zgłoszenie zostało wysłane",
            reportID: report.reportID,
            status: report.status,
        });
    } catch (err) {
        console.error("CREATE REPORT ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = { createReport };
