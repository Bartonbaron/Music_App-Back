const express = require("express");
const router = express.Router();

const { authenticateToken, requireCreator } = require("../../middleware/auth/authMiddleware");
const uploadPodcastM  = require("../../middleware/upload/uploadPodcastM");

const {uploadPodcast, getPodcast, getMyPodcasts, getAllPodcasts, updatePodcast, deletePodcast,
    incrementPodcastStream, favoritePodcast, unfavoritePodcast} = require("../../controllers/content/podcastsController");

router.get("/", authenticateToken, getAllPodcasts);

router.get("/my", authenticateToken, getMyPodcasts);

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
