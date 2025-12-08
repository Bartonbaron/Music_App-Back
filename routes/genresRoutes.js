const express = require("express");
const router = express.Router();
const genreController = require("../controllers/genresController");

router.get("/", genreController.getGenresList);
router.get("/:id", genreController.getGenre);
router.post("/", genreController.createGenre);
router.patch("/:id", genreController.updateGenre);
router.delete("/:id", genreController.deleteGenre);

module.exports = router;
