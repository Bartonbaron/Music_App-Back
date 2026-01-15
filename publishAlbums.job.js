const cron = require("node-cron");
const { Op } = require("sequelize");
const { models } = require("./models");

const Album = models.albums;

function startPublishAlbumsJob() {
    // co minutę
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();

            await Album.update(
                { isPublished: true },
                {
                    where: {
                        isPublished: false,
                        moderationStatus: "ACTIVE",
                        releaseDate: { [Op.ne]: null, [Op.lte]: now },
                    },
                }
            );
        } catch (e) {
            console.error("PUBLISH ALBUMS JOB ERROR:", e);
        }
    });
}

module.exports = { startPublishAlbumsJob };