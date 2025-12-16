const multer = require("multer");

const storage = multer.memoryStorage();

const allowedImages = ["image/jpeg", "image/png", "image/jpg"];

const uploadCoverM = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB (cover)
    },
    fileFilter: (req, file, cb) => {
        if (!allowedImages.includes(file.mimetype)) {
            return cb(
                new Error("Invalid image file — allowed formats: jpg, jpeg, png"),
                false
            );
        }
        cb(null, true);
    }
});

module.exports = uploadCoverM;
