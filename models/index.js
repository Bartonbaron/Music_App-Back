import { Sequelize } from 'sequelize';
import sequelize from '../config/database.js';
import initModels from './init-models.js';

const models = initModels(sequelize);

export { sequelize };
export default models;
