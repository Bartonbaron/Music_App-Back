const multer = require("multer");

const storage = multer.memoryStorage();


// Dozwolone audio + okładki
const allowedAudio = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/flac", "audio/x-flac"];
const allowedImages = ["image/jpeg", "image/png", "image/jpg"];

const uploadPodcast = multer({
    storage,
    fileFilter: (req, file, cb) => {
        // AUDIO (pole: "file")
        if (file.fieldname === "file") {
            if (!allowedAudio.includes(file.mimetype)) {
                return cb(new Error("Invalid audio file — allowed formats: mp3, wav, flac"), false);
            }
        }

        // COVER (pole: "cover")
        if (file.fieldname === "cover") {
            if (!allowedImages.includes(file.mimetype)) {
                return cb(new Error("Invalid image file — allowed formats: jpg, png"), false);
            }
        }

        cb(null, true);
    },

    limits: {
        fileSize: 50 * 1024 * 1024 // max 50 MB na audio
    }
});

module.exports = uploadPodcast;
