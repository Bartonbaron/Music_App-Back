const request = require("supertest");
const app = require("../app");

describe("Protected routes", () => {
    it("GET /api/creators/me without token should return 401", async () => {
        const res = await request(app).get("/api/creators/me");
        expect(res.statusCode).toBe(401);
    });
});