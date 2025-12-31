function extractKey(url) {
    if (!url) return null;

    const marker = ".amazonaws.com/";
    const idx = url.indexOf(marker);
    if (idx !== -1) return url.slice(idx + marker.length);

    return url.replace(/^\/+/, "");
}

module.exports = extractKey;
