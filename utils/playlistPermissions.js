const canAccessPlaylist = async (playlist, userID, models) => {
    const uid = Number(userID);
    if (!playlist || !Number.isFinite(uid)) return false;

    // Publiczna
    if (playlist.visibility === "P") return true;

    // Właściciel
    if (Number(playlist.userID) === uid) return true;

    // Prywatny, ale zaakceptowany współtwórca może wejść
    const PC = models?.playlistcollaborators;
    if (!PC) return false;

    const row = await PC.findOne({
        where: { playlistID: playlist.playlistID, userID: uid, status: "ACCEPTED" },
    });

    return !!row;
};

const canEditPlaylist = async (playlist, userID, models) => {
    const uid = Number(userID);
    if (!playlist || !Number.isFinite(uid)) return false;

    // Właściciel
    if (Number(playlist.userID) === uid) return true;

    // Jeśli tryb współtworzenia wyłączony – nikt poza właścicielem
    if (playlist.isCollaborative !== true) return false;

    // Włączony: tylko zaakceptowany współtwórca
    const PC = models?.playlistcollaborators;
    if (!PC) return false;

    const row = await PC.findOne({
        where: { playlistID: playlist.playlistID, userID: uid, status: "ACCEPTED" },
    });

    return !!row;
};

module.exports = { canAccessPlaylist, canEditPlaylist };
