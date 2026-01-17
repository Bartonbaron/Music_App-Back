const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../../config/s3");
const { models } = require("../../models");
const { presentUser } = require("../../utils/userPresenter");
const Users = models.users;
const Role = models.roles;
const extractKey = require("../../utils/extractKey");

const BUCKET = process.env.AWS_S3_BUCKET;

// Tworzy unikalną nazwę
const randomName = (original) => {
    const ext = original.split(".").pop();
    return `users/avatars/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
};

const uploadAvatar = async (req, res) => {
    try {
        const userID = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: "Nie przesłano pliku" });
        }

        const user = await Users.findByPk(userID);
        if (!user) {
            return res.status(404).json({ message: "Nie znaleziono użytkownika" });
        }

        if (user.profilePicURL) {
            const oldKey = extractKey(user.profilePicURL);
            if (oldKey) {
                await s3.send(
                    new DeleteObjectCommand({
                        Bucket: BUCKET,
                        Key: oldKey,
                    })
                );
            }
        }

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

        await user.update({ profilePicURL: newUrl });

        const freshUser = await Users.findByPk(userID, {
            attributes: [
                "userID",
                "userName",
                "email",
                "profilePicURL",
                "status",
                "createdAt",
                "volume",
                "playbackMode",
                "autoplay",
            ],
            include: [
                {
                    model: Role,
                    as: "role",
                    attributes: ["roleID", "roleName"],
                },
            ],
        });

        return res.json({
            message: "Zaktualizowano zdjęcie profilowe",
            user: await presentUser(freshUser),
        });
    } catch (err) {
        console.error("UPLOAD AVATAR ERROR:", err);
        return res.status(500).json({ message: "Nie udało się wgrać zdjęcia profilowego" });
    }
};

const deleteAvatar = async (req, res) => {
    try {
        const userID = req.user.id;

        const user = await Users.findByPk(userID);
        if (!user) {
            return res.status(404).json({ message: "Nie znaleziono użytkownika" });
        }

        if (!user.profilePicURL) {
            return res.status(400).json({ message: "Użytkownik nie posiada zdjęcia profilowego" });
        }

        const key = user.profilePicURL.split(".com/")[1];

        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: key,
            })
        );

        await user.update({ profilePicURL: null });

        return res.json({
            message: "Usunięto zdjęcie profilowe",
            user: await presentUser(user),
        });
    } catch (err) {
        console.error("DELETE AVATAR ERROR:", err);
        return res.status(500).json({ message: "Nie udało się usunąć zdjęcia profilowego" });
    }
};

module.exports = {
    uploadAvatar,
    deleteAvatar
};
