const { models } = require("../models");
const Genre = models.genres;

const getGenresList = async (req, res) => {
    try {
        const genres = await Genre.findAll();
        return res.json(genres);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

const getGenre = async (req, res) => {
    try {
        const { id } = req.params;
        const genre = await Genre.findByPk(id);

        if (!genre) return res.status(404).json({ message: "Genre not found" });

        return res.json(genre);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

const createGenre = async (req, res) => {
    try {
        const { genreName, description } = req.body;

        if (!genreName)
            return res.status(400).json({ message: "genreName is required" });

        const genre = await Genre.create({ genreName, description });

        return res.status(201).json(genre);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

const updateGenre = async (req, res) => {
    try {
        const { id } = req.params;
        const { genreName, description } = req.body;

        const genre = await Genre.findByPk(id);
        if (!genre) return res.status(404).json({ message: "Genre not found" });

        await genre.update({ genreName, description });

        return res.json(genre);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteGenre = async (req, res) => {
    try {
        const { id } = req.params;

        const genre = await Genre.findByPk(id);
        if (!genre) return res.status(404).json({ message: "Genre not found" });

        await genre.destroy();

        // reset AUTOINCREMENT jeśli tabela pusta
        const count = await Genre.count();
        if (count === 0) {
            await Genre.sequelize.query("ALTER TABLE genres AUTO_INCREMENT = 1;");
        }

        return res.json({ message: "Genre deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getGenresList,
    getGenre,
    createGenre,
    updateGenre,
    deleteGenre
}