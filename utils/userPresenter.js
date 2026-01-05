const extractKey = require("./extractKey");
const { generateSignedUrl } = require("../config/s3");

async function presentUser(userInstance) {
    if (!userInstance) return null;

    const u = userInstance.toJSON ? userInstance.toJSON() : userInstance;

    const signedProfilePicURL = u.profilePicURL
        ? await generateSignedUrl(extractKey(u.profilePicURL))
        : null;

    return {
        ...u,
        signedProfilePicURL,
    };
}

module.exports = { presentUser };
