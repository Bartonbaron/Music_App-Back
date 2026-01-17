const multer = require("multer");

const storage = multer.memoryStorage();

// Dozwolone audio + okładki
const allowedAudio = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/flac", "audio/x-flac"];
const allowedImages = ["image/jpeg", "image/png", "image/jpg"];

const uploadPodcastM = multer({
    storage,
    fileFilter: (req, file, cb) => {
        // AUDIO (pole: "file")
        if (file.fieldname === "file") {
            if (!allowedAudio.includes(file.mimetype)) {
                return cb(new Error("Nieprawidłowy plik audio. Dozwolone formaty: MP3, WAV, FLAC"), false);
            }
        }

        // COVER (pole: "cover")
        if (file.fieldname === "cover") {
            if (!allowedImages.includes(file.mimetype)) {
                return cb(new Error("Nieprawidłowy plik obrazu. Dozwolone formaty: JPG, PNG"), false);
            }
        }

        cb(null, true);
    },

    limits: {
        fileSize: 50 * 1024 * 1024 // max 50 MB na audio
    }
});

module.exports = uploadPodcastM;
