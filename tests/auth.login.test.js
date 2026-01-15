const request = require("supertest");
const app = require("../app");

describe("Auth login", () => {
    it("POST /api/auth/login should return JWT token", async () => {
        // najpierw rejestracja
        await request(app)
            .post("/api/auth/register")
            .send({
                userName: "loginuser",
                password: "Test123!",
                email: "login@test.pl",
            });

        const res = await request(app)
            .post("/api/auth/login")
            .send({
                login: "loginuser",
                password: "Test123!",
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("token");
        expect(typeof res.body.token).toBe("string");
    });
});