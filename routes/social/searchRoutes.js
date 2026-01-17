const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../../middleware/auth/authMiddleware");
const { search } = require("../../controllers/social/searchController");

router.get("/", authenticateToken, search);

module.exports = router;
