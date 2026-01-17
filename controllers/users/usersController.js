const { models } = require("../../models");
const bcrypt = require("bcryptjs");
const extractKey = require("../../utils/extractKey");
const { generateSignedUrl } = require("../../config/s3");
const { presentUser } = require("../../utils/userPresenter");
const User = models.users;
const Role = models.roles;
const Playlist = models.playlists;
const PlaylistSongs = models.playlistsongs;
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);

const { validatePassword } = require("../../utils/validatePassword");

// GET /api/users/me
const getMyProfile = async (req, res) => {
    try {
        const userID = req.user.id;

        const user = await User.findByPk(userID, {
            attributes: [
                "userID",
                "userName",
                "email",
                "profilePicURL",
                "status",
                "createdAt",
                "roleID",
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

        if (!user) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

        return res.json({
            message: "Pobrano profil użytkownika",
            user: await presentUser(user),
        });
    } catch (error) {
        console.error("GET MY PROFILE ERROR:", error);
        return res.status(500).json({ message: "Błąd serwera podczas pobierania profilu" });
    }
};

const getPublicUser = async (req, res) => {
    try {
        const { userID } = req.params;

        const user = await User.findByPk(userID, {
            attributes: ["userID", "userName", "profilePicURL", "createdAt", "status"],
            include: [{ model: Role, as: "role", attributes: ["roleID", "roleName"] }],
        });

        if (!user) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

        if (user.status === false) {
            return res.status(404).json({ message: "Nie znaleziono użytkownika" });
        }

        const presented = await presentUser(user);

        return res.json({
            message: "Pobrano profil publiczny użytkownika",
            user: {
                userID: presented.userID,
                userName: presented.userName,
                role: presented.role,
                createdAt: presented.createdAt,
                signedProfilePicURL: presented.signedProfilePicURL,
            },
        });
    } catch (err) {
        console.error("GET PUBLIC USER ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { userName, email, profilePicURL } = req.body;

        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

        const currentUserName = user.userName;
        const currentEmail = user.email;

        if (userName !== undefined) {
            const nameTrim = String(userName).trim();
            if (!nameTrim) return res.status(400).json({ message: "Nazwa użytkownika nie może być pusta" });

            if (nameTrim !== currentUserName) {
                const exists = await User.findOne({ where: { userName: nameTrim } });
                if (exists) return res.status(400).json({ message: "Nazwa użytkownika jest już zajęta" });
                user.userName = nameTrim;
            }
        }

        if (email !== undefined) {
            const emailTrim = email === null ? null : String(email).trim();

            if (emailTrim === null || emailTrim === "") {
                user.email = null;
            } else if (emailTrim !== currentEmail) {
                const exists = await User.findOne({ where: { email: emailTrim } });
                if (exists) return res.status(400).json({ message: "Ten adres e-mail jest już używany" });
                user.email = emailTrim;
            }
        }

        if (profilePicURL !== undefined) {
            user.profilePicURL = profilePicURL || null;
        }

        await user.save();

        return res.json({
            message: "Zaktualizowano profil",
            user: await presentUser(user),
        });
    } catch (error) {
        console.error("UPDATE ME ERROR:", error);
        return res.status(500).json({ message: "Błąd serwera podczas aktualizacji profilu" });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "Podaj stare i nowe hasło" });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                message:
                    "Hasło musi mieć co najmniej 8 znaków, zawierać jedną wielką literę, jedną cyfrę i jeden znak specjalny (!@#$%^&*)",
            });
        }

        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: "Nieprawidłowe stare hasło" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.json({ message: "Zmieniono hasło" });
    } catch (error) {
        console.error("CHANGE PASSWORD ERROR:", error);
        return res.status(500).json({ message: "Błąd serwera podczas zmiany hasła" });
    }
};

const updatePlaybackPreferences = async (req, res) => {
    try {
        const userID = req.user.id;
        const { volume, playbackMode, autoplay } = req.body;

        const updates = {};

        if (volume !== undefined) {
            const v = Number(volume);
            if (!Number.isFinite(v) || v < 0 || v > 1) {
                return res.status(400).json({ message: "Głośność musi być liczbą z zakresu 0–1" });
            }
            updates.volume = v;
        }

        if (playbackMode !== undefined) {
            const allowedModes = ["normal", "shuffle", "repeat"];
            if (!allowedModes.includes(playbackMode)) {
                return res.status(400).json({
                    message: "Tryb odtwarzania musi mieć wartość: normal, shuffle lub repeat",
                });
            }
            updates.playbackMode = playbackMode;
        }

        if (autoplay !== undefined) {
            if (typeof autoplay !== "boolean") {
                return res.status(400).json({ message: "Autoplay musi być wartością logiczną (true/false)" });
            }
            updates.autoplay = autoplay;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: "Nie podano poprawnych pól (volume, playbackMode, autoplay)",
            });
        }

        const user = await User.findByPk(userID);
        if (!user) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

        await user.update(updates);

        return res.json({
            message: "Zapisano preferencje odtwarzania",
            preferences: {
                volume: user.volume,
                playbackMode: user.playbackMode,
                autoplay: user.autoplay,
            },
        });
    } catch (err) {
        console.error("UPDATE PREFERENCES ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const deactivateOwnAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "Nie znaleziono użytkownika" });
        }

        if (req.user.roleID === ADMIN_ROLE_ID) {
            return res.status(400).json({
                message: "Administrator nie może zdezaktywować własnego konta",
            });
        }

        if (user.status === false) {
            return res.status(400).json({
                message: "Konto jest już zdezaktywowane",
            });
        }

        user.status = false;
        await user.save();

        res.json({
            message: "Konto zostało zdezaktywowane",
            userID: user.userID,
            status: user.status,
        });
    } catch (error) {
        console.error("Deactivate own account error:", error);
        res.status(500).json({
            message: "Błąd serwera podczas dezaktywacji konta",
        });
    }
};

const getPublicUserPlaylists = async (req, res) => {
    try {
        const { userID } = req.params;

        const playlists = await Playlist.findAll({
            where: { userID, visibility: "P" },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        const result = await Promise.all(
            playlists.map(async (p) => {
                const coverKey = p.coverURL ? extractKey(p.coverURL) : null;

                const songsCount = await PlaylistSongs.count({
                    where: { playlistID: p.playlistID },
                });

                return {
                    playlistID: p.playlistID,
                    playlistName: p.playlistName,
                    description: p.description ?? null,
                    createdAt: p.createdAt,
                    creatorName: p?.user?.userName ?? null,
                    songsCount,
                    signedCover: coverKey ? await generateSignedUrl(coverKey) : null,
                };
            })
        );

        return res.json(result);
    } catch (err) {
        console.error("GET PUBLIC USER PLAYLISTS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getMyProfile,
    getPublicUser,
    updateProfile,
    changePassword,
    updatePlaybackPreferences,
    deactivateOwnAccount,
    getPublicUserPlaylists
};
