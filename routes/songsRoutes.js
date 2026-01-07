const express = require("express");
const uploadSongM = require("../middleware/uploadSongM");
const uploadCoverM = require("../middleware/uploadCoverM");

const { authenticateToken, requireCreator } = require("../middleware/authMiddleware");

const {getSong, getSongsList, getMySongs, uploadSong, updateSong,
    deleteSong, incrementStreamCount, likeSong, unlikeSong} = require("../controllers/songsController");

const router = express.Router();

// Trasy
router.get("/", authenticateToken, getSongsList);
router.get("/my", authenticateToken, requireCreator, getMySongs);

router.post(
    "/upload", authenticateToken, requireCreator,
    uploadSongM.fields([
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    uploadSong
);

router.get("/:songID", authenticateToken, getSong);
router.post("/:id/like", authenticateToken, likeSong);
router.post("/:id/unlike", authenticateToken, unlikeSong);

router.delete("/:songID", authenticateToken, requireCreator, deleteSong);

router.patch(
    "/:songID",
    authenticateToken,
    requireCreator,
    uploadCoverM.single("cover"),
    updateSong
);
router.patch("/:id/stream", authenticateToken, incrementStreamCount);

module.exports = router;


