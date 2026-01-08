const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
    return sequelize.define("playlistcollaborators", {
        collaboratorID: {
            autoIncrement: true,
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        playlistID: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "playlists", key: "playlistID" },
        },
        userID: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "users", key: "userID" },
        },
        status: {
            type: DataTypes.ENUM("INVITED", "ACCEPTED"),
            allowNull: false,
            defaultValue: "INVITED",
        },
    }, {
        sequelize,
        tableName: "playlistcollaborators",
        timestamps: true,
        indexes: [
            { unique: true, using: "BTREE", fields: ["playlistID", "userID"] },
            { using: "BTREE", fields: ["playlistID"] },
            { using: "BTREE", fields: ["userID"] },
        ],
    });
};