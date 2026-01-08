const canAccessPlaylist = async (playlist, userID, models) => {
    const uid = Number(userID);
    if (!playlist || !Number.isFinite(uid)) return false;

    // publiczna
    if (playlist.visibility === "P") return true;

    // owner
    if (Number(playlist.userID) === uid) return true;

    // private, ale zaakceptowany współtwórca może wejść
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

    // owner
    if (Number(playlist.userID) === uid) return true;

    // jeśli tryb współtworzenia wyłączony – nikt poza ownerem
    if (playlist.isCollaborative !== true) return false;

    // włączony: tylko ACCEPTED collaborator
    const PC = models?.playlistcollaborators;
    if (!PC) return false;

    const row = await PC.findOne({
        where: { playlistID: playlist.playlistID, userID: uid, status: "ACCEPTED" },
    });

    return !!row;
};

module.exports = { canAccessPlaylist, canEditPlaylist };
