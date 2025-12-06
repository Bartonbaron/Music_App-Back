const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../config/s3");
const {models} = require("../models");
const Users = models.users;

const BUCKET = process.env.AWS_S3_BUCKET;

// Tworzy unikalną nazwę
const randomName = (original) => {
    const ext = original.split(".").pop();
    return `users/avatars/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
};

const uploadAvatar = async (req, res) => {
    try {
        const userID = req.user.id; // z JWT
        const file = req.file;

        if (!file) return res.status(400).json({ message: "No file provided" });

        const user = await Users.findByPk(userID);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Jeśli istnieje stary avatar -> usuwamy go z S3
        if (user.profilePicURL) {
            const oldKey = user.profilePicURL.split(".com/")[1];

            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET,
                    Key: oldKey,
                })
            );
        }

        // generowanie nazwy i upload
        const newKey = randomName(file.originalname);

        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: newKey,
                Body: file.buffer,
                ContentType: file.mimetype,
            })
        );

        const newUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${newKey}`;

        // zapis w MySQL
        await user.update({ profilePicURL: newUrl });

        res.json({
            message: "Avatar updated!",
            profilePicURL: newUrl,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Upload failed" });
    }
};



const deleteAvatar = async (req, res) => {
    try {
        const userID = req.user.id;

        const user = await Users.findByPk(userID);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.profilePicURL)
            return res.status(400).json({ message: "User has no avatar" });

        const key = user.profilePicURL.split(".com/")[1];

        // usuń plik z S3
        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: key,
            })
        );

        // usuń avatar w MySQL
        await user.update({ profilePicURL: null });

        res.json({ message: "Avatar removed" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Deletion failed" });
    }
};

module.exports = {
    uploadAvatar,
    deleteAvatar
};
