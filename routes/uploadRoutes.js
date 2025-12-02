const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const { models } = require("../models");
const Song = models.songs;
const mm = require('music-metadata')
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { generateSignedUrl } = require("../config/s3");
const router = express.Router();


// Multer - przyjmujemy plik z pamięci jako Buffer
const upload = multer({ storage: multer.memoryStorage() });

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

router.get("/songs/:songID", async (req, res) => {
    try {
        const { songID } = req.params;

        const song = await Song.findByPk(songID);
        if (!song) return res.status(404).json({ message: "Song not found" });

        // Wyciągnięcie kluczy S3 z URL-i zapisanych w DB
        const audioKey = song.fileURL.split(".amazonaws.com/")[1];
        const coverKey = song.coverURL.split(".amazonaws.com/")[1];

        // Generacja signed URL
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
});

router.get("/songs", async (req, res) => {
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
});


// Upload utworu do S3
router.post(
    "/upload/song",
    upload.fields([
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 }      // (opcjonalnie)
    ]),
    async (req, res) => {
        try {
            const audioFile = req.files?.file?.[0];
            const coverFile = req.files?.cover?.[0];

            // Reset AUTO_INCREMENT jeśli tabela pusta
            const count = await Song.count();
            if (count === 0) {
                await Song.sequelize.query("ALTER TABLE songs AUTO_INCREMENT = 1;");
            }

            if (!audioFile) {
                return res.status(400).json({ message: "Audio file is required" });
            }

            // Odczyt metadanych MP3 -> duration
            let duration = 0;
            try {
                const metadata = await mm.parseBuffer(audioFile.buffer);
                duration = Math.round(metadata.format.duration);
            } catch (err) {
                console.warn("Could not read metadata:", err);
            }

            if (!duration || isNaN(duration)) {
                return res.status(400).json({ message: "Could not extract duration" });
            }

            // Utwórz rekord -> fileURL & coverURL NULL
            const songName = audioFile.originalname.replace(/\.[^/.]+$/, "");

            const song = await Song.create({
                songName,
                duration,
                fileURL: null,
                coverURL: null,
                streamCount: 0,
                likeCount: 0
            });

            const songID = song.songID;


            // Upload MP3 do S3
            const audioKey = `audio/songs/${songID}.mp3`;

            await s3.send(new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: audioKey,
                Body: audioFile.buffer,
                ContentType: audioFile.mimetype
            }));

            const audioURL = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${audioKey}`;

            // Upload okładki do S3 (opcjonalnie)
            let coverURL = null;

            if (coverFile) {
                const coverExt = coverFile.originalname.split(".").pop();
                const coverKey = `covers/songs/${songID}.${coverExt}`;

                await s3.send(new PutObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: coverKey,
                    Body: coverFile.buffer,
                    ContentType: coverFile.mimetype
                }));

                coverURL = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${coverKey}`;
            }


            // Update rekordu w DB
            await song.update({
                fileURL: audioURL,
                coverURL: coverURL
            });

            return res.status(201).json({
                message: "Song uploaded with cover successfully!",
                song,
                audioURL,
                coverURL
            });

        } catch (err) {
            console.log("UPLOAD ERROR:", err);
            return res.status(500).json({ message: "Upload failed", error: err });
        }
    }
);

// Usuwanie utworu
router.delete("/song/:songID", async (req, res) => {
    try {
        const { songID } = req.params;

        // Pobierz utwór
        const song = await Song.findByPk(songID);
        if (!song) {
            return res.status(404).json({ message: "Song not found" });
        }

        const audioURL = song.fileURL;
        const coverURL = song.coverURL;


        // Wyciąganie "Key" z URL S3
        const extractKey = (url) => {
            if (!url) return null;
            const parts = url.split(".amazonaws.com/");
            return parts[1] || null;
        };

        const audioKey = extractKey(audioURL);
        const coverKey = extractKey(coverURL);

        // Kasowanie plików z S3
        const objectsToDelete = [];
        if (audioKey) objectsToDelete.push({ Key: audioKey });
        if (coverKey) objectsToDelete.push({ Key: coverKey });

        if (objectsToDelete.length > 0) {
            await s3.send(
                new DeleteObjectsCommand({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Delete: { Objects: objectsToDelete }
                })
            );
        }


        // Usuń rekord z DB
        await song.destroy();

        // RESET AUTO_INCREMENT jeśli tabela jest pusta
        const count = await Song.count();
        if (count === 0) {
            await Song.sequelize.query("ALTER TABLE songs AUTO_INCREMENT = 1;");
        }

        return res.status(200).json({
            message: "Song deleted successfully",
            deletedFiles: objectsToDelete.map(x => x.Key),
            autoIncrementReset: count === 0
        });

    } catch (err) {
        console.log("DELETE ERROR:", err);
        return res.status(500).json({ message: "Song delete failed", error: err });
    }
});

module.exports = router;


