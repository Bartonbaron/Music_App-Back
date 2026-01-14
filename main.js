const express = require('express');
require('dotenv').config();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({origin: "http://localhost:5173", credentials: true}));

const authRoutes = require('./routes/authRoutes');
const adminReportsRoutes = require('./routes/adminReportsRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const adminStatsRoutes = require('./routes/adminStatsRoutes');
const adminUsersRoutes = require('./routes/adminUsersRoutes');
const searchRoutes = require('./routes/searchRoutes');
const songsRoutes = require("./routes/songsRoutes");
const genresRoutes = require("./routes/genresRoutes");
const avatarRoutes = require("./routes/avatarRoutes");
const creatorRoutes = require("./routes/creatorRoutes");
const topicsRoutes = require("./routes/topicsRoutes");
const podcastsRoutes = require("./routes/podcastsRoutes");
const playlistsRoutes = require("./routes/playlistsRoutes");
const libraryRoutes = require("./routes/libraryRoutes");
const albumsRoutes = require("./routes/albumsRoutes");
const foldersRoutes = require("./routes/foldersRoutes");
const playHistoryRoutes = require("./routes/playHistoryRoutes");
const playQueueRoutes = require("./routes/playQueueRoutes");
const usersRoutes = require("./routes/usersRoutes");
const feedRoutes = require("./routes/feedRoutes");

// Global Middleware
app.use(express.json());

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

app.listen(port, () => {
    console.log(`Server is listening on port ${port}...`);
});
