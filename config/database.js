require("dotenv").config();
const { Sequelize } = require("sequelize");

const isTest = process.env.NODE_ENV === "test";
const dbName = isTest ? process.env.DB_NAME_TEST : process.env.DB_NAME;

if (!dbName) {
    throw new Error(
        `Missing ${isTest ? "DB_NAME_TEST" : "DB_NAME"} in environment variables`
    );
}

const sequelize = new Sequelize(dbName, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
});

module.exports = sequelize;
