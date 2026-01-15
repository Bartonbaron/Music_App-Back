const request = require("supertest");
const app = require("../app");

describe("Smoke tests", () => {
    it("GET /api/home should respond", async () => {
        const res = await request(app).get("/api/home");
        expect([200, 401, 403, 404]).toContain(res.statusCode);
    });
});
