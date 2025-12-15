const express = require('express');
require('dotenv').config();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({origin: "http://localhost:5173", credentials: true}));

const authRoutes = require('./routes/authRoutes');
const songsRoutes = require("./routes/songsRoutes");
const genresRoutes = require("./routes/genresRoutes");
const avatarRoutes = require("./routes/avatarRoutes");
const creatorRoutes = require("./routes/creatorRoutes");
const topicsRoutes = require("./routes/topicsRoutes");
const podcastsRoutes = require("./routes/podcastsRoutes");
const playlistsRoutes = require("./routes/playlistsRoutes");

// Global Middleware
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/creators", creatorRoutes);
app.use("/api/podcasts", podcastsRoutes);
app.use("/api/playlists", playlistsRoutes);
app.use("/api/songs", songsRoutes);
app.use("/api/genres", genresRoutes);
app.use("/api/topics", topicsRoutes);
app.use("/api/avatars", avatarRoutes);

app.get('/welcome', (req, res) => {
    res.send('Witaj!');
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}...`);
});
