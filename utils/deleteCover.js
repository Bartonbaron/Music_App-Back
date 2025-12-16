const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../config/s3");

const deleteCover = async ({ oldURL }) => {
    if (!oldURL) return null;

    const key = oldURL.split(".amazonaws.com/")[1];

    await s3.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
    }));

    return null;
};

module.exports = deleteCover;
