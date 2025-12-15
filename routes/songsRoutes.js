const express = require("express");
const multer = require("multer");

const { authenticateToken, requireCreator } = require("../middleware/authMiddleware");

const {getSong, getSongsList, uploadSong, deleteSong, incrementStreamCount, likeSong, unlikeSong} = require("../controllers/songsController");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Trasy
router.get("/:songID", authenticateToken, getSong);
router.get("/", authenticateToken, getSongsList);

router.post(
    "/upload",
    upload.fields([
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    authenticateToken, requireCreator, uploadSong
);

router.post("/:id/like", authenticateToken, likeSong);
router.post("/:id/unlike", authenticateToken, unlikeSong);

router.delete("/:songID", authenticateToken, requireCreator, deleteSong);
router.patch("/:id/stream", authenticateToken, incrementStreamCount);

module.exports = router;


