const express = require("express");
const multer = require("multer");

const {getSong, getSongsList, uploadSong, deleteSong, incrementStreamCount, likeSong, unlikeSong} = require("../controllers/songsController");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Trasy
router.get("/songs/:songID", getSong);
router.get("/songs", getSongsList);

router.post(
    "/upload/song",
    upload.fields([
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    uploadSong
);

router.post("/songs/:id/like", likeSong);
router.post("/songs/:id/unlike", unlikeSong);

router.delete("/song/:songID", deleteSong);
router.patch("/songs/:id/stream", incrementStreamCount);


module.exports = router;


