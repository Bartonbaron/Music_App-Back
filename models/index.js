const { Sequelize } = require('sequelize');
const initModels = require('./init-models');
const sequelize = require('../config/database');

const models = initModels(sequelize);

module.exports = {
    sequelize,
    Sequelize,
    models
};
