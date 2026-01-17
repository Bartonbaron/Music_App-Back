const multer = require("multer");

const storage = multer.memoryStorage();

const allowedAudio = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac"
];

const allowedImages = ["image/jpeg", "image/png", "image/jpg"];

const uploadSongM = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "file" && !allowedAudio.includes(file.mimetype)) {
            return cb(new Error("Nieobsługiwany format pliku audio"), false);
        }

        if (file.fieldname === "cover" && !allowedImages.includes(file.mimetype)) {
            return cb(new Error("Nieprawidłowy format pliku obrazu"), false);
        }

        cb(null, true);
    }
});

module.exports = uploadSongM;
