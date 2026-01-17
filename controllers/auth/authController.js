const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, models } = require('../../models');
require('dotenv').config();
const { Op } = require("sequelize");
const User = models.users;
const Role = models.roles;
const Library = models.library;

const { validatePassword } = require('../../utils/validatePassword');

// User registration
const registerUser = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { userName, password, email } = req.body;

        if (!userName || !password) {
            return res.status(400).json({
                message: 'Podaj nazwę użytkownika i hasło'
            });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                message:
                    'Hasło musi mieć co najmniej 8 znaków, zawierać jedną wielką literę, jedną cyfrę i jeden znak specjalny (!@#$%^&*)'
            });
        }

        const existingUser = await User.findOne({ where: { userName } });
        if (existingUser) {
            return res.status(400).json({ message: 'Użytkownik już istnieje' });
        }

        if (email) {
            const existingEmail = await User.findOne({ where: { email } });
            if (existingEmail) {
                return res.status(400).json({
                    message: 'Ten adres e-mail jest już używany'
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userRole = await Role.findOne({ where: { roleName: 'User' } });
        if (!userRole) {
            await transaction.rollback();
            return res.status(500).json({
                message: 'Błąd konfiguracji ról w systemie'
            });
        }

        const newUser = await User.create(
            {
                userName,
                password: hashedPassword,
                email,
                roleID: userRole.roleID,
                status: 1 // active account
            },
            { transaction }
        );

        await Library.create({ userID: newUser.userID }, { transaction });

        await transaction.commit();

        return res.status(201).json({
            message: 'Rejestracja zakończona sukcesem!',
            userID: newUser.userID,
            userName: newUser.userName
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Register user error:', error);
        return res.status(500).json({
            message: 'Błąd serwera podczas rejestracji'
        });
    }
};

// User login
const loginUser = async (req, res) => {
    try {
        const { userName, email, login, password } = req.body;

        const identifier = login || userName || email;
        if (!identifier || !password) {
            return res.status(400).json({
                message: 'Podaj login i hasło'
            });
        }

        const user = await User.findOne({
            where: {
                [Op.or]: [{ userName: identifier }, { email: identifier }]
            }
        });

        if (!user) {
            return res.status(401).json({
                message: 'Nieprawidłowe dane uwierzytelniające'
            });
        }

        if (user.status === false) {
            return res.status(403).json({
                message: 'Konto jest nieaktywne'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Nieprawidłowe dane uwierzytelniające'
            });
        }

        const token = jwt.sign(
            {
                id: user.userID,
                userName: user.userName,
                roleID: user.roleID
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        return res.json({
            message: 'Zalogowano pomyślnie!',
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            message: 'Błąd serwera podczas logowania'
        });
    }
};

// Wylogowanie
const logoutUser = async (req, res) => {
    return res.json({
        message: 'Wylogowano pomyślnie'
    });
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser
};
