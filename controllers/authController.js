const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { models } = require('../models');
const User = models.users;

// Walidacja hasła: min. 8 znaków, 1 duża litera, 1 cyfra, 1 znak specjalny
const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    return passwordRegex.test(password);
};

// Rejestracja użytkownika
const registerUser = async (req, res) => {
    try {
        const { userName, password, email } = req.body;

        if (!userName || !password) {
            return res.status(400).json({ message: 'Enter username and password' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                message:
                    'Password must be at least 8 characters long, include one uppercase letter, one number, and one special character (!@#$%^&*)'
            });
        }

        const existingUser = await User.findOne({ where: { userName } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            userName,
            password: hashedPassword,
            email,
            roleID: 1,         // domyślnie zwykły użytkownik
            status: 1          // aktywne konto
        });

        res.status(201).json({
            message: 'Registered successfully!',
            userID: newUser.userID,
            userName: newUser.userName
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};


// Logowanie użytkownika
const loginUser = async (req, res) => {
    try {
        const { userName, password } = req.body;

        const user = await User.findOne({ where: { userName } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.userID, userName: user.userName },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Successfully logged in!',
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// Przykładowa chroniona trasa
const protectedRoute = (req, res) => {
    res.json({ message: `Witaj, ${req.user.username}!`, user: req.user });
};

// Aktualizacja profilu użytkownika
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { userName, email, profilePicURL } = req.body;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // aktualizacja tylko przesłanych pól
        user.userName = userName || user.userName;
        user.email = email || user.email;
        user.profilePicURL = profilePicURL || user.profilePicURL;

        await user.save();

        res.json({
            message: 'Profile updated successfully!',
            user: {
                id: user.userID,
                userName: user.userName,
                email: user.email,
                profilePicURL: user.profilePicURL
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Server error during profile update' });
    }
};

// Zmiana hasła
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: 'Provide old and new passwords' });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                message:
                    'New password must be at least 8 characters long, include one uppercase letter, one number, and one special character (!@#$%^&*)'
            });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect old password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        await user.save();

        res.json({ message: 'Password changed successfully!' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ message: 'Server error during password change' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    protectedRoute,
    updateProfile,
    changePassword
};
