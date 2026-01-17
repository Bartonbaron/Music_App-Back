const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    console.log("UPLOAD AVATAR HIT:", req.originalUrl);
    console.log("FILE RECEIVED:", file.originalname, file.mimetype);

    const allowed = ["image/jpeg", "image/png", "image/jpg"];

    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Dozwolone formaty obrazów: JPG, JPEG, PNG"), false);
};

const uploadAvatarM = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter,
});

module.exports = uploadAvatarM;
