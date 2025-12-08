const express = require("express");
const router = express.Router();

const { authenticateToken, requireCreator } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadPodcast");

const {uploadPodcast, getPodcast, getAllPodcasts,
    deletePodcast, incrementPodcastStream, favoritePodcast, unfavoritePodcast, updatePodcastVisibility} = require("../controllers/podcastsController");

router.post(
    "/upload",
    authenticateToken,
    requireCreator,
    upload.fields([
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    uploadPodcast
);

router.get("/:id", authenticateToken, getPodcast);

router.get("/", authenticateToken, getAllPodcasts);

router.delete("/:id", authenticateToken, requireCreator, deletePodcast);

router.patch("/:id/stream", authenticateToken, incrementPodcastStream);
router.patch("/:id/visibility", authenticateToken, requireCreator, updatePodcastVisibility);

router.post("/:id/favorite", authenticateToken, favoritePodcast);
router.post("/:id/unfavorite", authenticateToken, unfavoritePodcast);

module.exports = router;
