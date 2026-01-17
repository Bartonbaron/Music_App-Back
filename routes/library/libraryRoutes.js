const express = require("express");
const router = express.Router();
const {authenticateToken} = require("../../middleware/auth/authMiddleware");

const { getLibrary, getLibraryPlaylists, getLibraryPlaylistsList, getLikedSongsList,
    getLibrarySongs, getLibraryPodcasts, getLibraryAlbums, getFavoritePodcasts} = require("../../controllers/library/libraryController");

router.get("/", authenticateToken, getLibrary);

router.get("/playlists", authenticateToken, getLibraryPlaylists);

router.get("/playlists/list", authenticateToken, getLibraryPlaylistsList);

router.get("/liked-songs", authenticateToken, getLikedSongsList);

router.get("/albums", authenticateToken, getLibraryAlbums);

router.get("/songs", authenticateToken, getLibrarySongs);

router.get("/podcasts", authenticateToken, getLibraryPodcasts);

router.get("/favorite-podcasts", authenticateToken, getFavoritePodcasts);

module.exports = router;
