exports.uploadSong = async (req, res) => {
    console.log("REQ.FILE ->", req.file);

    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    res.status(200).json({
        message: "File received!",
        filename: req.file.originalname,
        size: req.file.size
    });
};
