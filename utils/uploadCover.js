const { PutObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../config/s3");

const BUCKET = process.env.AWS_S3_BUCKET;

const uploadCover = async ({file, oldURL, folder, filename, contentType}) => {
    if (!file) {
        throw new Error("Plik okładki jest wymagany");
    }

    // usuń stary cover
    if (oldURL) {
        const oldKey = oldURL.split(".amazonaws.com/")[1];
        if (oldKey) {
            await s3.send(new DeleteObjectsCommand({
                Bucket: BUCKET,
                Delete: { Objects: [{ Key: oldKey }] }
            }));
        }
    }

    const ext = file.originalname.split(".").pop();
    const key = `${folder}/${filename}.${ext}`;

    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: contentType || file.mimetype
    }));

    return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

module.exports = uploadCover;
