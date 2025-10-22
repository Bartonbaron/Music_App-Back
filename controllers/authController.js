const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

let users = []; // temporary, will be replaced with database eventually

const registerUser = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ message: 'Enter username and password' });

    const existingUser = users.find(u => u.username === username);
    if (existingUser)
        return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: users.length + 1, username, password: hashedPassword };
    users.push(newUser);

    res.status(201).json({ message: 'Registered successfully!' });
};

const loginUser = async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ message: 'Invalid data credentials' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
        return res.status(401).json({ message: 'Invalid data credentials' });

    const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    res.json({ message: 'Successfully logged in!', token });
};

const protectedRoute = (req, res) => {
    res.json({ message: `Witaj, ${req.user.username}!`, user: req.user });
};

module.exports = {
    registerUser,
    loginUser,
    protectedRoute
};
