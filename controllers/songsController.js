const { S3Client, PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const mm = require("music-metadata");

const { sequelize, models } = require("../models");
const Song = models.songs;
const UserSongLikes = models.usersonglikes;
const FavoriteSongs = models.favoritesongs;

const { generateSignedUrl } = require("../config/s3");

require("dotenv").config();

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const getSong = async (req, res) => {
    try {
        const { songID } = req.params;

        const song = await Song.findByPk(songID);
        if (!song) return res.status(404).json({ message: "Song not found" });

        const audioKey = song.fileURL.split(".amazonaws.com/")[1];
        const coverKey = song.coverURL.split(".amazonaws.com/")[1];

        const signedAudio = await generateSignedUrl(audioKey);
        const signedCover = await generateSignedUrl(coverKey);

        return res.json({
            songID: song.songID,
            title: song.title,
            artist: song.artist,
            duration: song.duration,
            signedAudio,
            signedCover
        });

    } catch (err) {
        console.error("GET SONG ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// Lista utworów
const getSongsList = async (req, res) => {
    try {
        const songs = await Song.findAll();

        const result = await Promise.all(
            songs.map(async (song) => {
                const audioKey = song.fileURL.split(".amazonaws.com/")[1];
                const coverKey = song.coverURL.split(".amazonaws.com/")[1];

                return {
                    songID: song.songID,
                    title: song.title,
                    artist: song.artist,
                    duration: song.duration,
                    signedAudio: await generateSignedUrl(audioKey),
                    signedCover: await generateSignedUrl(coverKey)
                };
            })
        );

        return res.json(result);

    } catch (err) {
        console.error("GET SONGS LIST ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};




// Upload utworu
const uploadSong = async (req, res) => {
    try {
        const audioFile = req.files?.file?.[0];
        const coverFile = req.files?.cover?.[0];

        // Reset AUTO_INCREMENT jeśli pusto
        const count = await Song.count();
        if (count === 0) {
            await Song.sequelize.query("ALTER TABLE songs AUTO_INCREMENT = 1;");
        }

        if (!audioFile) {
            return res.status(400).json({ message: "Audio file is required" });
        }

        // Duration
        let duration = 0;
        try {
            const metadata = await mm.parseBuffer(audioFile.buffer);
            duration = Math.round(metadata.format.duration);
        } catch (err) {
            console.warn("Metadata error:", err);
        }

        if (!duration) return res.status(400).json({ message: "Invalid audio metadata" });

        const songName = audioFile.originalname.replace(/\.[^/.]+$/, "");

        // Stwórz najpierw rekord w bazie
        const song = await Song.create({
            songName,
            duration,
            fileURL: null,
            coverURL: null,
            streamCount: 0,
            likeCount: 0
        });

        const songID = song.songID;

        // Upload audio do S3
        const audioKey = `audio/songs/${songID}.mp3`;

        await s3.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: audioKey,
            Body: audioFile.buffer,
            ContentType: audioFile.mimetype
        }));

        const audioURL =
            `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${audioKey}`;

        // Upload cover
        let coverURL = null;
        if (coverFile) {
            const ext = coverFile.originalname.split(".").pop();
            const coverKey = `covers/songs/${songID}.${ext}`;

            await s3.send(new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: coverKey,
                Body: coverFile.buffer,
                ContentType: coverFile.mimetype
            }));

            coverURL =
                `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${coverKey}`;
        }

        await song.update({ fileURL: audioURL, coverURL });

        return res.status(201).json({
            message: "Song uploaded successfully!",
            song,
            audioURL,
            coverURL
        });

    } catch (err) {
        console.log("UPLOAD ERROR:", err);
        return res.status(500).json({ message: "Upload failed", error: err });
    }
};




// Usuwanie utworu
const deleteSong = async (req, res) => {
    try {
        const { songID } = req.params;

        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Song not found" });
        }

        const extractKey = (url) =>
            url ? url.split(".amazonaws.com/")[1] : null;

        const audioKey = extractKey(song.fileURL);
        const coverKey = extractKey(song.coverURL);

        const objectsToDelete = [];
        if (audioKey) objectsToDelete.push({ Key: audioKey });
        if (coverKey) objectsToDelete.push({ Key: coverKey });

        if (objectsToDelete.length > 0) {
            const cmd = new DeleteObjectsCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Delete: { Objects: objectsToDelete }
            });
            await s3.send(cmd);
        }


        await song.destroy();


        const count = await Song.count();
        if (count === 0) {
            await Song.sequelize.query("ALTER TABLE songs AUTO_INCREMENT = 1;");
        }

        return res.json({
            message: "Song deleted",
            deletedFiles: objectsToDelete.map(x => x.Key),
            autoIncrementReset: count === 0
        });

    } catch (err) {
        console.log("DELETE ERROR:", err);
        return res.status(500).json({ message: "Delete failed", error: err });
    }
};




// Increment stream count
const incrementStreamCount = async (req, res) => {
    try {
        const { id } = req.params;
        const song = await Song.findByPk(id);

        if (!song) return res.status(404).json({ message: "Song not found" });

        await song.increment("streamCount");

        return res.json({
            message: "Stream count incremented",
            streamCount: song.streamCount + 1
        });

    } catch (err) {
        console.log("STREAM ERROR:", err);
        return res.status(500).json({ message: "Failed to increment stream", error: err });
    }
};



// Polubienie utworu
const likeSong = async (req, res) => {
    try {
        const { id } = req.params;
        const { userID } = req.body;

        const song = await Song.findByPk(id);
        if (!song) return res.status(404).json({ message: "Song not found" });

        const exists = await UserSongLikes.findOne({ where: { userID, songID: id } });
        if (exists) return res.status(400).json({ message: "Already liked" });

        await UserSongLikes.create({ userID, songID: id });

        song.likeCount += 1;
        await song.save();

        await FavoriteSongs.create({ userID, songID: id });

        return res.json({ message: "Song liked", likeCount: song.likeCount });

    } catch (err) {
        console.log("LIKE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

// Anulowanie polubienia
const unlikeSong = async (req, res) => {
    try {
        const { id } = req.params;
        const { userID } = req.body;

        const song = await Song.findByPk(id);
        if (!song) return res.status(404).json({ message: "Song not found" });

        // Sprawdzenie czy polubiony
        const like = await UserSongLikes.findOne({ where: { userID, songID: id } });
        if (!like) {
            return res.status(400).json({ message: "Not liked" });
        }

        await like.destroy();

        // Dekrementacja likeCount
        song.likeCount = Math.max(0, song.likeCount - 1);
        await song.save();

        // Usuwanie z ulubionych (favorites)
        await FavoriteSongs.destroy({ where: { userID, songID: id } });

        // Jeśli po usunięciu tabela jest pusta -> reset AUTO_INCREMENT
        const count = await FavoriteSongs.count();
        if (count === 0) {
            await sequelize.query("ALTER TABLE favoriteSongs AUTO_INCREMENT = 1");
        }

        return res.json({ message: "Song unliked", likeCount: song.likeCount });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getSong,
    getSongsList,
    uploadSong,
    deleteSong,
    incrementStreamCount,
    likeSong,
    unlikeSong
}
