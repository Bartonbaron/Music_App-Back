const { models } = require("../../models");
const Topic = models.topics;

// GET ALL TOPICS
const getAllTopics = async (req, res) => {
    try {
        const topics = await Topic.findAll();
        res.json(topics);
    } catch (err) {
        console.error("GET TOPICS ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// GET ONE TOPIC
const getTopic = async (req, res) => {
    try {
        const topic = await Topic.findByPk(req.params.id);
        if (!topic)
            return res.status(404).json({ message: "Nie znaleziono tematu" });

        res.json(topic);
    } catch (err) {
        console.error("GET TOPIC ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// CREATE TOPIC (tylko admin)
const createTopic = async (req, res) => {
    try {
        const { topicName, description } = req.body;

        if (!topicName) {
            return res.status(400).json({ message: "Pole topicName jest wymagane" });
        }

        const topic = await Topic.create({ topicName, description });

        res.status(201).json({
            message: "Temat został utworzony",
            topic
        });

    } catch (err) {
        console.error("CREATE TOPIC ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// UPDATE TOPIC (tylko admin)
const updateTopic = async (req, res) => {
    try {
        const topic = await Topic.findByPk(req.params.id);
        if (!topic)
            return res.status(404).json({ message: "Nie znaleziono tematu" });

        const { topicName, description } = req.body;

        topic.topicName = topicName || topic.topicName;
        topic.description = description || topic.description;

        await topic.save();

        res.json({
            message: "Temat został zaktualizowany",
            topic
        });

    } catch (err) {
        console.error("UPDATE TOPIC ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

// DELETE TOPIC (tylko admin)
const deleteTopic = async (req, res) => {
    try {
        const topic = await Topic.findByPk(req.params.id);
        if (!topic)
            return res.status(404).json({ message: "Nie znaleziono tematu" });

        await topic.destroy();

        res.json({ message: "Temat został usunięty" });

    } catch (err) {
        console.error("DELETE TOPIC ERROR:", err);
        res.status(500).json({ message: "Błąd serwera" });
    }
};

module.exports = {
    getAllTopics,
    getTopic,
    createTopic,
    updateTopic,
    deleteTopic
};
