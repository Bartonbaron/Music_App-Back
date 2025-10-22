const express = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Global Middleware
app.use(express.json());

const authRoutes = require('./routes/authRoutes');

app.use('/api/auth', authRoutes);

app.get('/welcome', (req, res) => {
    res.send('Witaj!');
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}...`);
});
