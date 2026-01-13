const express = require("express");
const router = express.Router();
const {authenticateToken, requireAdmin} = require("../middleware/authMiddleware");
const {getGenresList, getGenre, createGenre, updateGenre, deleteGenre} = require("../controllers/genresController");

router.get("/", authenticateToken, getGenresList);
router.post("/", authenticateToken, requireAdmin, createGenre);

router.get("/:id", authenticateToken, getGenre);
router.patch("/:id", authenticateToken, requireAdmin, updateGenre);
router.delete("/:id", authenticateToken, requireAdmin, deleteGenre);

module.exports = router;
