const SequelizeErd = require('sequelize-erd');
const path = require('path');
const sequelize = require('./config/database');
const models = require('./models');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        const svg = await SequelizeErd({ source: sequelize });
        const outputPath = path.join(__dirname, 'erd-diagram.svg');

        require('fs').writeFileSync(outputPath, svg);
        console.log(`ERD diagram saved in: ${outputPath}`);
    } catch (error) {
        console.error('Generation error:', error);
    } finally {
        await sequelize.close();
    }
})();
