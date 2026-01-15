const request = require("supertest");
const app = require("../app");

describe("Auth middleware – invalid token", () => {
    it("GET /api/creators/me with invalid token should return 403", async () => {
        const res = await request(app)
            .get("/api/creators/me")
            .set("Authorization", "Bearer invalid.token.here");

        expect([401, 403]).toContain(res.statusCode);
    });
});
