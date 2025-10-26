const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('songs', {
    songID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    songName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    creatorID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'creatorprofiles',
        key: 'creatorID'
      }
    },
    genreID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'genres',
        key: 'genreID'
      }
    },
    albumID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'albums',
        key: 'albumID'
      }
    },
    fileURL: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    streamCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    likeCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    coverURL: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'songs',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "songID" },
        ]
      },
      {
        name: "creatorID",
        using: "BTREE",
        fields: [
          { name: "creatorID" },
        ]
      },
      {
        name: "genreID",
        using: "BTREE",
        fields: [
          { name: "genreID" },
        ]
      },
      {
        name: "albumID",
        using: "BTREE",
        fields: [
          { name: "albumID" },
        ]
      },
    ]
  });
};
