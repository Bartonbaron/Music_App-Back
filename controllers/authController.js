const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, models } = require('../models');
require('dotenv').config();
const { Op } = require("sequelize");
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID);
const User = models.users;
const Role = models.roles;
const Library = models.library;
const CreatorProfile = models.creatorprofiles;

const { validatePassword } = require('../utils/validatePassword');

// Rejestracja użytkownika
const registerUser = async (req, res) => {
    const transaction = await sequelize.transaction();

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
        if (email) {
            const existingEmail = await User.findOne({ where: { email } });
            if (existingEmail) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userRole = await Role.findOne({ where: { roleName: 'User' } });

        const newUser = await User.create({
            userName,
            password: hashedPassword,
            email,
            roleID: userRole.roleID,
            status: 1          // aktywne konto
        }, {transaction});

        await Library.create({
            userID: newUser.userID
        }, { transaction });

        await transaction.commit();

        res.status(201).json({
            message: 'Registered successfully!',
            userID: newUser.userID,
            userName: newUser.userName
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// Logowanie użytkownika
const loginUser = async (req, res) => {
    try {
        const { userName, email, login, password } = req.body;

        const identifier = login || userName || email;
        if (!identifier || !password) {
            return res.status(400).json({ message: "Provide login and password" });
        }

        const user = await User.findOne({
            where: {
                [Op.or]: [{ userName: identifier }, { email: identifier }],
            },
        });

        if (!user) return res.status(401).json({ message: "Invalid credentials" });

        if (user.status === false) {
            return res.status(403).json({ message: "Account is deactivated" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user.userID, userName: user.userName, roleID: user.roleID },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return res.json({ message: "Successfully logged in!", token });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Server error during login" });
    }
};

const logoutUser = async (req, res) => {
    return res.json({
        message: "Logged out successfully"
    });
};

const deactivateOwnAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // admin nie może zdezaktywować siebie
        if (req.user.roleID === ADMIN_ROLE_ID) {
            return res.status(400).json({
                message: "Admin cannot deactivate own account"
            });
        }

        if (user.status === false) {
            return res.status(400).json({
                message: "Account already deactivated"
            });
        }

        user.status = false;
        await user.save();

        res.json({
            message: "Account deactivated successfully",
            userID: user.userID,
            status: user.status
        });

    } catch (error) {
        console.error("Deactivate own account error:", error);
        res.status(500).json({
            message: "Server error during account deactivation"
        });
    }
};

const promoteToCreator = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const userId = req.params.id;

        const user = await User.findByPk(userId, { transaction });
        if (!user) {
            await transaction.rollback();
            return res.status(404).json({ message: "User not found" });
        }

        const creatorRole = await Role.findOne({
            where: { roleName: "Creator" },
            transaction
        });

        if (user.roleID === creatorRole.roleID) {
            await transaction.rollback();
            return res.status(400).json({
                message: "User is already a Creator"
            });
        }

        // zmiana roli
        user.roleID = creatorRole.roleID;
        await user.save({ transaction });

        // creatorProfile
        const [profile, created] = await CreatorProfile.findOrCreate({
            where: { userID: userId },
            defaults: {
                bio: null,
                numberOfFollowers: 0,
                isActive: true
            },
            transaction
        });

        if (!created && profile.isActive === false) {
            profile.isActive = true;
            await profile.save({ transaction });
        }

        await transaction.commit();

        res.json({
            message: "User promoted to Creator",
            userID: userId
        });

    } catch (err) {
        await transaction.rollback();
        console.error("PROMOTE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const demoteCreator = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const userId = req.params.id;

        const user = await User.findByPk(userId, {
            include: { model: Role, as: "role" },
            transaction
        });

        if (!user || user.role.roleName !== "Creator") {
            await transaction.rollback();
            return res.status(400).json({
                message: "User is not a Creator"
            });
        }

        const userRole = await Role.findOne({
            where: { roleName: "User" },
            transaction
        });

        // dezaktywuj twórcę
        const profile = await CreatorProfile.findOne({
            where: { userID: userId },
            transaction
        });

        if (profile) {
            profile.isActive = false;
            await profile.save({ transaction });
        }

        // zmień rolę
        user.roleID = userRole.roleID;
        await user.save({ transaction });

        await transaction.commit();

        res.json({
            message: "Creator demoted (content preserved)",
            userID: userId
        });

    } catch (err) {
        await transaction.rollback();
        console.error("DEMOTE ERROR:", err);
        res.status(500).json({ message: "Server error" });
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
    logoutUser,
    deactivateOwnAccount,
    promoteToCreator,
    demoteCreator,
    getAllUsers,
    getAllCreators
};
