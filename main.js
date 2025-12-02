const express = require('express');
const multer = require("multer");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Global Middleware
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require("./routes/uploadRoutes");

app.use('/api/auth', authRoutes);
app.use("/api", uploadRoutes);

app.get('/welcome', (req, res) => {
    res.send('Witaj!');
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}...`);
});
