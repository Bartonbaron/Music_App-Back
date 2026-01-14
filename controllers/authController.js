const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, models } = require('../models');
require('dotenv').config();
const { Op } = require("sequelize");
const User = models.users;
const Role = models.roles;
const Library = models.library;

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
            { expiresIn: "12h" }
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
    getAllUsers,
    getAllCreators
};
