const request = require("supertest");
const app = require("../app");

describe("Auth register", () => {
    it("POST /api/auth/register should create user", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({
                userName: "testuser1",
                password: "Test123!",
                email: "test1@test.pl",
            });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("userID");
        expect(res.body.userName).toBe("testuser1");
    });
});