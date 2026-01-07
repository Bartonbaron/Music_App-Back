const express = require("express");
const router = express.Router();

const { authenticateToken, requireCreator } = require("../middleware/authMiddleware");
const uploadPodcastM  = require("../middleware/uploadPodcastM");

const {uploadPodcast, getPodcast, getAllPodcasts, updatePodcast, deletePodcast,
    incrementPodcastStream, favoritePodcast, unfavoritePodcast} = require("../controllers/podcastsController");

router.post(
    "/upload",
    authenticateToken,
    requireCreator,
    uploadPodcastM.fields([
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    uploadPodcast
);

router.get("/:id", authenticateToken, getPodcast);

router.get("/", authenticateToken, getAllPodcasts);

router.delete("/:id", authenticateToken, requireCreator, deletePodcast);

router.patch(
    "/:id",
    authenticateToken,
    requireCreator,
    uploadPodcastM.fields([
        { name: "cover", maxCount: 1 }
    ]),
    updatePodcast
);

router.patch("/:id/stream", authenticateToken, incrementPodcastStream);

router.post("/:id/favorite", authenticateToken, favoritePodcast);
router.post("/:id/unfavorite", authenticateToken, unfavoritePodcast);

module.exports = router;
