const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('playqueue', {
    queueID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
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
    songID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'songs',
        key: 'songID'
      }
    },
    podcastID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'podcasts',
        key: 'podcastID'
      }
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'playqueue',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "queueID" },
        ]
      },
      {
        name: "userID",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
      {
        name: "songID",
        using: "BTREE",
        fields: [
          { name: "songID" },
        ]
      },
      {
        name: "podcastID",
        using: "BTREE",
        fields: [
          { name: "podcastID" },
        ]
      },
    ]
  });
};
