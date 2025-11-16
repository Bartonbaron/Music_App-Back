const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { models } = require('../models');
const User = models.users;
const Role = models.roles;

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

        const userRole = await Role.findOne({ where: { roleName: 'User' } });

        const newUser = await User.create({
            userName,
            password: hashedPassword,
            email,
            roleID: userRole.roleID,
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

        // blokada logowania
        if (user.status === false) {
            return res.status(403).json({ message: 'Account is deactivated' });
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

const deactivateAccount = async (req, res) => {
    try {
        const userId = req.user.id; // pobrane z tokena JWT

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.status === false) {
            return res.status(400).json({ message: 'Account is already deactivated' });
        }

        user.status = false; // dezaktywacja
        await user.save();

        res.json({
            message: 'Account deactivated successfully',
            userID: user.userID,
            status: user.status
        });
    } catch (error) {
        console.error('Deactivate account error:', error);
        res.status(500).json({ message: 'Server error during account deactivation' });
    }
};

const reactivateAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.status === true) {
            return res.status(400).json({ message: 'Account is already active' });
        }

        user.status = true;
        await user.save();

        res.json({ message: 'Account reactivated successfully!' });
    } catch (error) {
        console.error('Account reactivation error:', error);
        return res.status(500).json({ message: 'Server error during account reactivation' });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.id; // ID z tokena JWT

        const user = await User.findByPk(userId, {
            attributes: ['userID', 'userName', 'email', 'profilePicURL', 'status', 'createdAt'],
            include: [
                {
                    model: Role,
                    as: "role",
                    attributes: ['roleID', 'roleName']
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'User profile fetched successfully',
            user
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ message: 'Server error during profile fetch' });
    }
};

const promoteToCreator = async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await models.users.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const creatorRole = await models.roles.findOne({
            where: { roleName: "Creator" }
        });

        if (!creatorRole) {
            return res.status(500).json({ message: "Role 'Creator' not found in database" });
        }

        user.roleID = creatorRole.roleID;
        await user.save();

        res.json({
            message: "User promoted to Creator successfully",
            user: {
                id: user.userID,
                userName: user.userName,
                role: "Creator"
            }
        });

    } catch (error) {
        console.error("Promote user error:", error);
        res.status(500).json({ message: "Server error during promotion" });
    }
};

const demoteCreator = async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await models.users.findByPk(userId, {
            include: { model: models.roles, as: 'role' }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Sprawdzenie czy user jest Twórcą
        if (user.role.roleName !== 'Creator') {
            return res.status(400).json({
                message: 'User is not a Creator'
            });
        }

        // Pobierz rolę "User"
        const userRole = await models.roles.findOne({
            where: { roleName: 'User' }
        });

        if (!userRole) {
            return res.status(500).json({
                message: 'Role "User" not found in database'
            });
        }

        // Aktualizacja roli
        user.roleID = userRole.roleID;
        await user.save();

        return res.json({
            message: 'User demoted from Creator to User successfully',
            userID: user.userID
        });

    } catch (err) {
        console.error("Demote user error:", err);
        res.status(500).json({ message: "Server error during demote" });
    }
};

const getAllCreators = async (req, res) => {
    try {
        const creators = await models.users.findAll({
            include: {
                model: models.roles,
                as: 'role',
                where: { roleName: 'Creator' }
            },
            attributes: ['userID', 'userName', 'email', 'status', 'createdAt']
        });

        res.json({
            count: creators.length,
            creators
        });

    } catch (error) {
        console.error("Get creators error:", error);
        res.status(500).json({ message: "Server error while fetching creators" });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const allUsers = await models.users.findAll({
            include: {
                model: models.roles,
                as: 'role',
                attributes: ['roleName']
            },
            attributes: ['userID', 'userName', 'email', 'status', 'createdAt']
        });

        res.json({
            count: allUsers.length,
            users: allUsers
        });

    } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({ message: "Server error while fetching users" });
    }
};


module.exports = {
    registerUser,
    loginUser,
    protectedRoute,
    updateProfile,
    changePassword,
    deactivateAccount,
    reactivateAccount,
    getProfile,
    promoteToCreator,
    demoteCreator,
    getAllUsers,
    getAllCreators
};
