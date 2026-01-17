const { models } = require("../../models");
const Genre = models.genres;

const getGenresList = async (req, res) => {
    try {
        const genres = await Genre.findAll();
        return res.json(genres);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const getGenre = async (req, res) => {
    try {
        const { id } = req.params;
        const genre = await Genre.findByPk(id);

        if (!genre) return res.status(404).json({ message: "Nie znaleziono gatunku" });

        return res.json(genre);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const createGenre = async (req, res) => {
    try {
        const { genreName, description } = req.body;

        if (!genreName)
            return res.status(400).json({ message: "Pole genreName jest wymagane" });

        const genre = await Genre.create({ genreName, description });

        return res.status(201).json(genre);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const updateGenre = async (req, res) => {
    try {
        const { id } = req.params;
        const { genreName, description } = req.body;

        const genre = await Genre.findByPk(id);
        if (!genre) return res.status(404).json({ message: "Nie znaleziono gatunku" });

        await genre.update({ genreName, description });

        return res.json(genre);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

const deleteGenre = async (req, res) => {
    try {
        const { id } = req.params;

        const genre = await Genre.findByPk(id);
        if (!genre) return res.status(404).json({ message: "Nie znaleziono gatunku" });

        await genre.destroy();

        return res.json({ message: "Gatunek został usunięty" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getGenresList,
    getGenre,
    createGenre,
    updateGenre,
    deleteGenre
}