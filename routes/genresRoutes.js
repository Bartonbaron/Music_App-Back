const express = require("express");
const router = express.Router();
const genreController = require("../controllers/genresController");

router.get("/genres", genreController.getGenresList);
router.get("/genres/:id", genreController.getGenre);
router.post("/genres", genreController.createGenre);
router.patch("/genres/:id", genreController.updateGenre);
router.delete("/genres/:id", genreController.deleteGenre);

module.exports = router;
