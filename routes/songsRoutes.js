const express = require("express");
const multer = require("multer");

const {getSong, getSongsList, uploadSong, deleteSong, incrementStreamCount, likeSong, unlikeSong} = require("../controllers/songsController");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Trasy
router.get("/:songID", getSong);
router.get("/", getSongsList);

router.post(
    "/upload",
    upload.fields([
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    uploadSong
);

router.post("/:id/like", likeSong);
router.post("/:id/unlike", unlikeSong);

router.delete("/:songID", deleteSong);
router.patch("/:id/stream", incrementStreamCount);


module.exports = router;


