const express = require("express");
require("dotenv").config();
const cors = require("cors");

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

const authRoutes = require("./routes/auth/authRoutes");
const adminReportsRoutes = require("./routes/admin/adminReportsRoutes");
const reportsRoutes = require("./routes/social/reportsRoutes");
const moderationRoutes = require("./routes/admin/moderationRoutes");
const adminStatsRoutes = require("./routes/admin/adminStatsRoutes");
const adminUsersRoutes = require("./routes/admin/adminUsersRoutes");
const searchRoutes = require("./routes/social/searchRoutes");
const songsRoutes = require("./routes/content/songsRoutes");
const genresRoutes = require("./routes/content/genresRoutes");
const avatarRoutes = require("./routes/users/avatarRoutes");
const creatorRoutes = require("./routes/creators/creatorRoutes");
const topicsRoutes = require("./routes/content/topicsRoutes");
const podcastsRoutes = require("./routes/content/podcastsRoutes");
const playlistsRoutes = require("./routes/playlists/playlistsRoutes");
const libraryRoutes = require("./routes/library/libraryRoutes");
const albumsRoutes = require("./routes/content/albumsRoutes");
const foldersRoutes = require("./routes/library/foldersRoutes");
const playHistoryRoutes = require("./routes/playback/playHistoryRoutes");
const playQueueRoutes = require("./routes/playback/playQueueRoutes");
const usersRoutes = require("./routes/users/usersRoutes");
const feedRoutes = require("./routes/social/feedRoutes");
const homeRoutes = require("./routes/social/homeRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminStatsRoutes);
app.use("/api/admin", adminReportsRoutes);
app.use("/api/admin", adminUsersRoutes);
app.use("/api/admin", moderationRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/creators", creatorRoutes);
app.use("/api/podcasts", podcastsRoutes);
app.use("/api/playlists", playlistsRoutes);
app.use("/api/libraries", libraryRoutes);
app.use("/api/songs", songsRoutes);
app.use("/api/genres", genresRoutes);
app.use("/api/topics", topicsRoutes);
app.use("/api/avatars", avatarRoutes);
app.use("/api/albums", albumsRoutes);
app.use("/api/folders", foldersRoutes);
app.use("/api/playhistory", playHistoryRoutes);
app.use("/api/queue", playQueueRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/home", homeRoutes);

module.exports = app;