jest.mock("music-metadata", () => ({}), { virtual: true });

jest.mock("@aws-sdk/client-s3", () => {
    return {
        S3Client: jest.fn(() => ({})),
        PutObjectCommand: jest.fn(),
        DeleteObjectsCommand: jest.fn(),
    };
});

jest.mock("@aws-sdk/s3-request-presigner", () => {
    return {
        getSignedUrl: jest.fn(() => Promise.resolve("https://signed-url.test")),
    };
});

const { sequelize, models } = require("../models");

async function seedBaseData() {
    // Upewnij się, że role istnieją (minimum do rejestracji/logowania)
    await models.roles.bulkCreate(
        [
            { roleName: "User" },
            { roleName: "Creator" },
            { roleName: "ADMIN" }, // albo "Admin" – zależnie co masz w DB w normalnym środowisku
        ],
        { ignoreDuplicates: true }
    );
}

async function resetDb() {
    await sequelize.sync({ force: true });
    await seedBaseData();
}

beforeAll(async () => {
    await resetDb();
});

beforeEach(async () => {
    await resetDb();
});

afterAll(async () => {
    await sequelize.close();
});

module.exports = { resetDb, models };


