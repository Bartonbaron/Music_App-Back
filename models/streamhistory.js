const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'streamhistory',
        {
            streamID: {
                type: DataTypes.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },

            userID: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'userID'
                }
            },

            targetType: {
                type: DataTypes.ENUM('song', 'podcast'),
                allowNull: false
            },

            targetID: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        },
        {
            sequelize,
            tableName: 'streamhistory',
            timestamps: true,
            updatedAt: false,
            indexes: [
                {
                    name: "idx_stream_user_target",
                    using: "BTREE",
                    fields: ["userID", "targetType", "targetID"]
                },
                {
                    name: "idx_stream_createdAt",
                    using: "BTREE",
                    fields: ["createdAt"]
                }
            ]
        }
    );
};
