const { models } = require("../models");
const Topic = models.topics;

// GET ALL TOPICS
const getAllTopics = async (req, res) => {
    try {
        const topics = await Topic.findAll();
        res.json(topics);
    } catch (err) {
        console.error("GET TOPICS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// GET ONE TOPIC
const getTopic = async (req, res) => {
    try {
        const topic = await Topic.findByPk(req.params.id);
        if (!topic)
            return res.status(404).json({ message: "Topic not found" });

        res.json(topic);
    } catch (err) {
        console.error("GET TOPIC ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// CREATE TOPIC ( tylko admin)
const createTopic = async (req, res) => {
    try {
        const { topicName, description } = req.body;

        if (!topicName) {
            return res.status(400).json({ message: "topicName is required" });
        }

        const topic = await Topic.create({ topicName, description });

        res.status(201).json({
            message: "Topic created",
            topic
        });

    } catch (err) {
        console.error("CREATE TOPIC ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// UPDATE TOPIC (tylko admin)
const updateTopic = async (req, res) => {
    try {
        const topic = await Topic.findByPk(req.params.id);
        if (!topic)
            return res.status(404).json({ message: "Topic not found" });

        const { topicName, description } = req.body;

        topic.topicName = topicName || topic.topicName;
        topic.description = description || topic.description;

        await topic.save();

        res.json({
            message: "Topic updated",
            topic
        });

    } catch (err) {
        console.error("UPDATE TOPIC ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE TOPIC (Tylko admin)
const deleteTopic = async (req, res) => {
    try {
        const topic = await Topic.findByPk(req.params.id);
        if (!topic)
            return res.status(404).json({ message: "Topic not found" });

        await topic.destroy();

        res.json({ message: "Topic deleted" });

    } catch (err) {
        console.error("DELETE TOPIC ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getAllTopics,
    getTopic,
    createTopic,
    updateTopic,
    deleteTopic
};
