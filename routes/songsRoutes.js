const express = require("express");
const uploadSongM = require("../middleware/uploadSongM");

const { authenticateToken, requireCreator } = require("../middleware/authMiddleware");

const {getSong, getSongsList, uploadSong, deleteSong, incrementStreamCount, likeSong, unlikeSong} = require("../controllers/songsController");

const router = express.Router();

// Trasy
router.get("/:songID", authenticateToken, getSong);
router.get("/", authenticateToken, getSongsList);

router.post(
    "/upload", authenticateToken, requireCreator,
    uploadSongM.fields([
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    uploadSong
);

router.post("/:id/like", authenticateToken, likeSong);
router.post("/:id/unlike", authenticateToken, unlikeSong);

router.delete("/:songID", authenticateToken, requireCreator, deleteSong);
router.patch("/:id/stream", authenticateToken, incrementStreamCount);

module.exports = router;


