const express = require("express");
const router = express.Router();
const {authenticateToken, requireAdmin} = require("../middleware/authMiddleware");
const {getGenresList, getGenre, createGenre, updateGenre, deleteGenre} = require("../controllers/genresController");

router.get("/", authenticateToken, getGenresList);
router.get("/:id", authenticateToken, getGenre);
router.post("/", authenticateToken, requireAdmin, createGenre);
router.patch("/:id", authenticateToken, requireAdmin, updateGenre);
router.delete("/:id", authenticateToken, requireAdmin, deleteGenre);

module.exports = router;
