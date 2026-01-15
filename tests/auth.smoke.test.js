const request = require("supertest");
const app = require("../app");

describe("Auth smoke tests", () => {
    it("POST /api/auth/login should respond", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ login: "x", password: "y" });

        expect([200, 400, 401]).toContain(res.statusCode);
    });
});