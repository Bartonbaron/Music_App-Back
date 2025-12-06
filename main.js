const express = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const authRoutes = require('./routes/authRoutes');
const songsRoutes = require("./routes/songsRoutes");
const genresRoutes = require("./routes/genresRoutes");
const avatarRoutes = require("./routes/avatarRoutes");
const creatorRoutes = require("./routes/creatorRoutes");

app.use("/api/", avatarRoutes);

// Global Middleware
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use("/api", songsRoutes);
app.use("/api/", genresRoutes);
app.use("/api/", creatorRoutes);

app.get('/welcome', (req, res) => {
    res.send('Witaj!');
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}...`);
});
