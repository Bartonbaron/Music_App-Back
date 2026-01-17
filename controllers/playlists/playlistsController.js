const { models, sequelize } = require("../../models");
const {Op} = require("sequelize");

const { generateSignedUrl } = require("../../config/s3");
const extractKey = require("../../utils/extractKey");
const {canAccessPlaylist, canEditPlaylist} = require("../../utils/playlistPermissions");
const uploadCover = require("../../utils/uploadCover");
const deleteCover = require("../../utils/deleteCover");

const Playlist = models.playlists;
const Song = models.songs;
const User = models.users;
const CreatorProfile = models.creatorprofiles;
const Album = models.albums;
const PlaylistSongs = models.playlistsongs;
const PlaylistActivity = models.playlistactivities;
const Library = models.library;
const LibraryPlaylists = models.libraryplaylists;
const PlaylistCollaborator = models.playlistcollaborators;

const isAdmin = (req) => Number(req.user?.roleID) === Number(process.env.ADMIN_ROLE_ID);

const canSeeHiddenPlaylist = (playlist, req) => {
    const uid = Number(req.user?.userID ?? req.user?.id);
    return isAdmin(req) || Number(playlist.userID) === uid; // admin albo owner
};

const createPlaylist = async (req, res) => {
    const t = await Playlist.sequelize.transaction();
    try {
        const { playlistName, description } = req.body;
        const coverFile = req.files?.cover?.[0];

        if (!playlistName) {
            await t.rollback();
            return res.status(400).json({ message: "Nazwa playlisty jest wymagana" });
        }

        const playlist = await Playlist.create(
            {
                playlistName,
                description: description || null,
                userID: req.user.id,
                coverURL: null,
            },
            { transaction: t }
        );

        const [library] = await Library.findOrCreate({
            where: { userID: req.user.id },
            defaults: { userID: req.user.id },
            transaction: t,
        });

        await LibraryPlaylists.findOrCreate({
            where: { libraryID: library.libraryID, playlistID: playlist.playlistID },
            defaults: { libraryID: library.libraryID, playlistID: playlist.playlistID },
            transaction: t,
        });

        await t.commit();

        if (coverFile) {
            try {
                const coverURL = await uploadCover({
                    file: coverFile,
                    oldURL: null,
                    folder: "covers/playlists",
                    filename: playlist.playlistID,
                });

                await playlist.update({ coverURL });
            } catch (e) {
                console.error("PLAYLIST COVER UPLOAD ERROR:", e);
            }
        }

        const fresh = await Playlist.findByPk(playlist.playlistID);

        return res.status(201).json({
            message: "Utworzono playlistę",
            playlist: {
                ...(fresh ? fresh.toJSON() : playlist.toJSON()),
                signedCover: (fresh?.coverURL || playlist.coverURL)
                    ? await generateSignedUrl(extractKey(fresh?.coverURL || playlist.coverURL))
                    : null,
            },
        });
    } catch (err) {
        await t.rollback();
        console.error("CREATE PLAYLIST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const getUserPlaylists = async (req, res) => {
    try {
        const playlists = await Playlist.findAll({
            where: { userID: req.user.id }
        });

        const result = await Promise.all(
            playlists.map(async (playlist) => ({
                ...playlist.toJSON(),
                signedCover: playlist.coverURL
                    ? await generateSignedUrl(extractKey(playlist.coverURL))
                    : null
            }))
        );

        res.json(result);

    } catch (err) {
        console.error("GET MY PLAYLISTS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getPlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName"],
                },
            ],
        });
        if (!playlist) {
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        if (playlist.moderationStatus !== "ACTIVE" && !canSeeHiddenPlaylist(playlist, req)) {
            return res.status(403).json({ message: "Playlista jest niedostępna" });
        }

        if (!(await canAccessPlaylist(playlist, req.user.userID ?? req.user.id, models))) {
            return res.status(403).json({ message: "Ta playlista jest prywatna" });
        }

        res.json({
            ...playlist.toJSON(),
            signedCover: playlist.coverURL
                ? await generateSignedUrl(extractKey(playlist.coverURL))
                : null
        });

    } catch (err) {
        console.error("GET PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getPlaylistActivity = async (req, res) => {
    try {
        const playlistID = req.params.id;

        const playlist = await Playlist.findByPk(playlistID);

        if (playlist.moderationStatus !== "ACTIVE" && !canSeeHiddenPlaylist(playlist, req)) {
            return res.status(403).json({ message: "Playlista jest niedostępna" });
        }

        if (!playlist) {
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        if (!canAccessPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "Ta playlista jest prywatna" });
        }

        const limit = Math.min(Number(req.query.limit) || 50, 200);

        const activities = await PlaylistActivity.findAll({
            where: { playlistID },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["userID", "userName"]
                },
                {
                    model: Song,
                    as: "song",
                    attributes: ["songID", "songName"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit
        });

        res.json(activities);

    } catch (err) {
        console.error("GET PLAYLIST ACTIVITY ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const updatePlaylist = async (req, res) => {
    try {
        const playlistID = Number(req.params.id);
        const userID = req.user.id;

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Nie znaleziono playlisty" });

        const isOwner = Number(playlist.userID) === Number(userID);

        // jeśli nie owner sprawdź, czy jest ACCEPTED współtwórcą
        let isAcceptedCollab = false;
        if (!isOwner) {
            if (!playlist.isCollaborative) {
                return res.status(403).json({ message: "Playlista nie jest współtworzona" });
            }

            const collabRow = await PlaylistCollaborator.findOne({
                where: { playlistID, userID, status: "ACCEPTED" },
            });

            isAcceptedCollab = !!collabRow;

            if (!isAcceptedCollab) {
                return res.status(403).json({ message: "Nie masz uprawnień do edycji tej playlisty" });
            }
        }

        const { playlistName, description, visibility, isCollaborative } = req.body;
        const patch = {};

        if (isOwner) {
            if (playlistName !== undefined) patch.playlistName = playlistName;
            if (description !== undefined) patch.description = description;
            if (visibility !== undefined) patch.visibility = visibility;
            if (isCollaborative !== undefined) patch.isCollaborative = isCollaborative;
        } else {
            if (playlistName !== undefined) patch.playlistName = playlistName;
            if (description !== undefined) patch.description = description;

            if (visibility !== undefined || isCollaborative !== undefined) {
                return res.status(403).json({ message: "Tylko właściciel może zmienić widoczność/tryb współpracy" });
            }
        }

        await playlist.update(patch);

        return res.json({
            message: "Zaktualizowano playlistę",
            playlist,
        });
    } catch (err) {
        console.error("PATCH PLAYLIST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const deletePlaylist = async (req, res) => {
    const t = await Playlist.sequelize.transaction();
    let coverURL = null;

    try {
        const playlist = await Playlist.findByPk(req.params.id, { transaction: t });

        if (!playlist) {
            await t.rollback();
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        if (playlist.userID !== req.user.id) {
            await t.rollback();
            return res.status(403).json({ message: "Możesz usuwać tylko własne playlisty" });
        }

        const playlistID = playlist.playlistID;
        coverURL = playlist.coverURL || null;

        await LibraryPlaylists.destroy({ where: { playlistID }, transaction: t });
        await PlaylistSongs.destroy({ where: { playlistID }, transaction: t });
        await PlaylistActivity.destroy({ where: { playlistID }, transaction: t });

        await playlist.destroy({ transaction: t });

        await t.commit();

        if (coverURL) {
            try {
                await deleteCover({ oldURL: coverURL });
            } catch (e) {
                console.warn("DELETE PLAYLIST COVER FAILED (post-commit):", e?.message || e);
            }
        }

        return res.json({ message: "Usunięto playlistę" });
    } catch (err) {
        try { await t.rollback(); } catch (_) {}
        console.error("DELETE PLAYLIST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const addSongToPlaylist = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const playlistID = Number(req.params.playlistID);
        const songID = Number(req.body.songID);

        const userID = Number(req.user?.userID ?? req.user?.id);

        if (!Number.isFinite(userID) || userID <= 0) {
            await t.rollback();
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        if (!Number.isFinite(playlistID) || playlistID <= 0) {
            await t.rollback();
            return res.status(400).json({ message: "Nieprawidłowe playlistID" });
        }

        if (!Number.isFinite(songID) || songID <= 0) {
            await t.rollback();
            return res.status(400).json({ message: "Pole songID jest wymagane" });
        }

        // Playlist
        const playlist = await Playlist.findByPk(playlistID, { transaction: t });
        if (!playlist) {
            await t.rollback();
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        if (!canAccessPlaylist(playlist, userID)) {
            await t.rollback();
            return res.status(403).json({ message: "Ta playlista jest prywatna" });
        }

        if (!canEditPlaylist(playlist, userID)) {
            await t.rollback();
            return res.status(403).json({ message: "Brak uprawnień do modyfikacji tej playlisty" });
        }

        // Song
        const song = await Song.findByPk(songID, { transaction: t });
        if (!song) {
            await t.rollback();
            return res.status(404).json({ message: "Nie znaleziono utworu" });
        }

        const exists = await PlaylistSongs.findOne({
            where: { playlistID, songID },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (exists) {
            await t.rollback();
            return res.status(400).json({ message: "Utwór jest już na playliście" });
        }

        // Ustal pozycję jako ostatnią (w transakcji, z lockiem)
        const lastRow = await PlaylistSongs.findOne({
            where: { playlistID },
            attributes: ["position"],
            order: [["position", "DESC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        const nextPos = (lastRow?.position || 0) + 1;

        // Dodaj
        await PlaylistSongs.create(
            { playlistID, songID, position: nextPos },
            { transaction: t }
        );

        // Zapisz aktywność ADD
        await PlaylistActivity.create(
            {
                playlistID,
                songID,
                userID,
                action: "ADD",
            },
            { transaction: t }
        );

        await t.commit();
        return res.status(201).json({ message: "Dodano utwór do playlisty" });
    } catch (err) {
        await t.rollback();
        console.error("ADD SONG TO PLAYLIST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const removeSongFromPlaylist = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const playlistID = Number(req.params.playlistID);
        const songID = Number(req.params.songID);
        const userID = Number(req.user?.userID ?? req.user?.id);

        if (!Number.isFinite(userID) || userID <= 0) {
            await t.rollback();
            return res.status(401).json({ message: "Brak autoryzacji" });
        }
        if (!Number.isFinite(playlistID) || playlistID <= 0) {
            await t.rollback();
            return res.status(400).json({ message: "Nieprawidłowe playlistID" });
        }
        if (!Number.isFinite(songID) || songID <= 0) {
            await t.rollback();
            return res.status(400).json({ message: "Nieprawidłowe songID" });
        }

        const playlist = await Playlist.findByPk(playlistID, { transaction: t });
        if (!playlist) {
            await t.rollback();
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        // prywatność playlisty (dostęp)
        if (!(await canAccessPlaylist(playlist, userID, models))) {
            await t.rollback();
            return res.status(403).json({ message: "Ta playlista jest prywatna" });
        }

        // edycja playlisty (owner / collaborator accepted / admin etc.)
        if (!(await canEditPlaylist(playlist, userID, models))) {
            await t.rollback();
            return res.status(403).json({ message: "Brak uprawnień do modyfikacji tej playlisty" });
        }

        const entry = await PlaylistSongs.findOne({
            where: { playlistID, songID },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!entry) {
            await t.rollback();
            return res.status(400).json({ message: "Utworu nie ma na tej playliście" });
        }

        const removedPosition = entry.position;

        await entry.destroy({ transaction: t });

        await PlaylistActivity.create(
            {
                playlistID,
                songID,
                userID,
                action: "REMOVE",
            },
            { transaction: t }
        );

        // zbij pozycje elementów po usuniętym
        await PlaylistSongs.increment(
            { position: -1 },
            {
                where: {
                    playlistID,
                    position: { [Op.gt]: removedPosition },
                },
                transaction: t,
            }
        );

        await t.commit();
        return res.json({ message: "Usunięto utwór z playlisty" });
    } catch (err) {
        try { await t.rollback(); } catch (_) {}
        console.error("REMOVE SONG FROM PLAYLIST ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

const getPlaylistSongs = async (req, res) => {
    try {
        const playlistID = Number(req.params.id);
        const userID = Number(req.user?.userID ?? req.user?.id);

        if (!Number.isFinite(playlistID) || playlistID <= 0) {
            return res.status(400).json({ message: "Nieprawidłowe ID playlisty" });
        }
        if (!Number.isFinite(userID) || userID <= 0) {
            return res.status(401).json({ message: "Brak autoryzacji" });
        }

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Nie znaleziono playlisty" });

        if (playlist.moderationStatus !== "ACTIVE" && !canSeeHiddenPlaylist(playlist, req)) {
            return res.status(403).json({ message: "Playlista jest niedostępna" });
        }

        if (!(await canAccessPlaylist(playlist, userID, models))) {
            return res.status(403).json({ message: "Ta playlista jest prywatna" });
        }

        const items = await PlaylistSongs.findAll({
            where: { playlistID: playlist.playlistID },
            include: [
                {
                    model: Song,
                    as: "song",
                    include: [
                        {
                            model: CreatorProfile,
                            as: "creator",
                            include: [{ model: User, as: "user", attributes: ["userID", "userName"] }],
                        },
                        {
                            model: Album,
                            as: "album",
                            attributes: ["albumID", "albumName", "coverURL"],
                        },
                    ],
                },
            ],
            order: [["position", "ASC"]],
        });

        const songIDs = items.map((i) => i.songID).filter(Boolean);

        const lastAddsRaw = songIDs.length
            ? await PlaylistActivity.findAll({
                where: {
                    playlistID: playlist.playlistID,
                    action: "ADD",
                    songID: { [Op.in]: songIDs },
                },
                include: [{ model: User, as: "user", attributes: ["userID", "userName"] }],
                order: [["createdAt", "DESC"]],
            })
            : [];

        const lastAddBySongID = new Map();
        for (const a of lastAddsRaw) {
            const key = String(a.songID);
            if (!lastAddBySongID.has(key)) lastAddBySongID.set(key, a);
        }

        const mapped = await Promise.all(
            items.map(async (item) => {
                const s = item.song;
                if (!s) return null;

                const hidden = s.moderationStatus === "HIDDEN";

                const albumSignedCover =
                    s?.album?.coverURL
                        ? await generateSignedUrl(extractKey(s.album.coverURL))
                        : null;

                const lastAdd = lastAddBySongID.get(String(item.songID));

                return {
                    playlistID: item.playlistID,
                    songID: item.songID,
                    position: item.position,
                    addedAt: item.addedAt ?? null,
                    addedBy: lastAdd?.user
                        ? { userID: lastAdd.user.userID, userName: lastAdd.user.userName }
                        : null,

                    creatorName: s?.creator?.user?.userName ?? null,

                    song: {
                        ...s.toJSON(),
                        isHidden: hidden,
                        creatorName: s?.creator?.user?.userName ?? null,

                        signedAudio:
                            !hidden && s.fileURL
                                ? await generateSignedUrl(extractKey(s.fileURL))
                                : null,

                        signedCover: s.coverURL
                            ? await generateSignedUrl(extractKey(s.coverURL))
                            : null,

                        album: s.album
                            ? {
                                ...(typeof s.album.toJSON === "function"
                                    ? s.album.toJSON()
                                    : s.album),
                                signedCover: albumSignedCover,
                            }
                            : null,
                    },
                };
            })
        );

        return res.json(mapped.filter(Boolean));
    } catch (err) {
        console.error("GET PLAYLIST SONGS ERROR:", err);
        return res.status(500).json({ message: "Błąd serwera" });
    }
};

// Dodawanie do biblioteki
const addPlaylistToLibrary = async (req, res) => {
    try {
        const playlistID = req.params.id;

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) {
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        if (!canAccessPlaylist(playlist, req.user.id)) {
            return res.status(403).json({ message: "Ta playlista jest prywatna" });
        }

        const library = await Library.findOne({
            where: { userID: req.user.id }
        });

        if (!library) {
            return res.status(404).json({ message: "Nie znaleziono biblioteki" });
        }

        const exists = await LibraryPlaylists.findOne({
            where: { libraryID: library.libraryID, playlistID }
        });

        if (exists) {
            return res.status(400).json({ message: "Playlista jest już w bibliotece" });
        }

        await LibraryPlaylists.create({
            libraryID: library.libraryID,
            playlistID
        });

        res.json({ message: "Dodano playlistę do biblioteki" });

    } catch (err) {
        console.error("ADD PLAYLIST TO LIBRARY ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const reorderPlaylistSongs = async (req, res) => {
    try {
        const { order } = req.body;
        const playlistID = req.params.id;
        const userID = req.user.userID ?? req.user.id;

        if (!Array.isArray(order)) {
            return res.status(400).json({ message: "Order musi być tablicą" });
        }

        // upewnij się, że to liczby
        const orderNums = order.map((x) => Number(x)).filter((x) => Number.isFinite(x));
        if (orderNums.length !== order.length) {
            return res.status(400).json({ message: "Order musi zawierać poprawne songID" });
        }

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Nie znaleziono playlisty" });

        if (!(await canAccessPlaylist(playlist, userID, models))) {
            return res.status(403).json({ message: "Ta playlista jest prywatna" });
        }

        if (!(await canEditPlaylist(playlist, userID, models))) {
            return res.status(403).json({ message: "Brak uprawnień do modyfikacji tej playlisty" });
        }

        const items = await PlaylistSongs.findAll({
            where: { playlistID },
            attributes: ["songID"],
            raw: true,
        });

        const playlistSongIDs = items.map((i) => Number(i.songID));
        if (orderNums.length !== playlistSongIDs.length) {
            return res.status(400).json({
                message: "Kolejność musi zawierać wszystkie utwory z playlisty",
            });
        }

        const setA = new Set(playlistSongIDs);
        const invalid = orderNums.filter((sid) => !setA.has(sid));
        if (invalid.length) {
            return res.status(400).json({
                message: "Niektóre utwory nie należą do tej playlisty",
                invalidSongIDs: invalid,
            });
        }

        // (opcjonalnie) jeśli order ma duplikaty
        const setB = new Set(orderNums);
        if (setB.size !== orderNums.length) {
            return res.status(400).json({ message: "Order zawiera duplikaty" });
        }

        for (let i = 0; i < orderNums.length; i++) {
            await PlaylistSongs.update(
                { position: i + 1 },
                { where: { playlistID, songID: orderNums[i] } }
            );
        }

        res.json({ message: "Zmieniono kolejność playlisty" });
    } catch (err) {
        console.error("REORDER PLAYLIST ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// REMOVE
const removePlaylistFromLibrary = async (req, res) => {
    try {
        const playlistID = req.params.id;

        const library = await Library.findOne({
            where: { userID: req.user.id }
        });

        await LibraryPlaylists.destroy({
            where: { libraryID: library.libraryID, playlistID }
        });

        res.json({ message: "Usunięto playlistę z biblioteki" });

    } catch (err) {
        console.error("REMOVE PLAYLIST FROM LIBRARY ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const changePlaylistVisibility = async (req, res) => {
    try {
        const { visibility } = req.body;
        const playlistID = req.params.id;
        const userID = req.user.userID ?? req.user.id;

        if (!["P", "R"].includes(visibility)) {
            return res.status(400).json({ message: "Nieprawidłowa wartość visibility" });
        }

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) return res.status(404).json({ message: "Nie znaleziono playlisty" });

        if (Number(playlist.userID) !== Number(userID)) {
            return res.status(403).json({ message: "Tylko właściciel może zmienić widoczność" });
        }

        playlist.visibility = visibility;
        await playlist.save();

        res.json({ message: "Zaktualizowano widoczność", visibility });
    } catch (err) {
        console.error("CHANGE PLAYLIST VISIBILITY ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const toggleCollaborative = async (req, res) => {
    try {
        const { isCollaborative } = req.body;
        const playlistID = req.params.id;

        if (typeof isCollaborative !== "boolean") {
            return res.status(400).json({ message: "Nieprawidłowa wartość (wymagany boolean)" });
        }

        const playlist = await Playlist.findByPk(playlistID);
        if (!playlist) {
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        const userID = req.user.userID ?? req.user.id;
        if (playlist.userID !== userID) {
            return res.status(403).json({ message: "Tylko właściciel może zmienić tryb współpracy" });
        }

        playlist.isCollaborative = isCollaborative;
        await playlist.save();

        res.json({
            message: "Zaktualizowano tryb współpracy",
            isCollaborative: playlist.isCollaborative,
        });
    } catch (err) {
        console.error("TOGGLE COLLABORATIVE ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const uploadPlaylistCover = async (req, res) => {
    try {
        const playlist = await Playlist.findByPk(req.params.id);
        if (!playlist) return res.status(404).json({ message: "Nie znaleziono playlisty" });

        if (playlist.userID !== req.user.id) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        const coverURL = await uploadCover({
            file: req.files?.cover?.[0],
            oldURL: playlist.coverURL,
            folder: "covers/playlists",
            filename: playlist.playlistID
        });

        await playlist.update({ coverURL });

        res.json({ message: "Przesłano okładkę playlisty", coverURL });

    } catch (err) {
        console.error("UPLOAD PLAYLIST COVER ERROR:", err);
        res.status(500).json({ message: err.message || "Nie udało się przesłać pliku" });
    }
};

const deletePlaylistCover = async (req, res) => {
    try {
        const playlist = await Playlist.findByPk(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: "Nie znaleziono playlisty" });
        }

        if (playlist.userID !== req.user.id) {
            return res.status(403).json({ message: "Brak uprawnień" });
        }

        if (!playlist.coverURL) {
            return res.status(400).json({ message: "Playlista nie ma okładki" });
        }

        await deleteCover({ oldURL: playlist.coverURL });

        await playlist.update({ coverURL: null });

        res.json({ message: "Usunięto okładkę playlisty" });

    } catch (err) {
        console.error("DELETE PLAYLIST COVER ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    createPlaylist,
    getUserPlaylists,
    getPlaylist,
    getPlaylistActivity,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    getPlaylistSongs,
    addPlaylistToLibrary,
    removePlaylistFromLibrary,
    reorderPlaylistSongs,
    changePlaylistVisibility,
    toggleCollaborative,
    uploadPlaylistCover,
    deletePlaylistCover
}
