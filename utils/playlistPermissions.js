const canAccessPlaylist = (playlist, userID) => {
    return playlist.visibility === "P" || playlist.userID === userID;
};

const canEditPlaylist = (playlist, userID) => {
    return playlist.userID === userID || playlist.isCollaborative === "Y";
};

module.exports = {
    canAccessPlaylist,
    canEditPlaylist
};
