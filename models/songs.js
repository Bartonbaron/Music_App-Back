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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    creatorID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'creatorprofiles',
        key: 'creatorID'
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
    genreID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'genres',
        key: 'genreID'
      }
    },
    fileURL: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    streamCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    moderationStatus: {
      type: DataTypes.ENUM("ACTIVE", "HIDDEN"),
      allowNull: false,
      defaultValue: "ACTIVE"
    },
    likeCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    coverURL: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    trackNumber: {
      type: DataTypes.INTEGER,
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
        name: "fk_songs_creators",
        using: "BTREE",
        fields: [
          { name: "creatorID" },
        ]
      },
      {
        name: "fk_songs_albums",
        using: "BTREE",
        fields: [
          { name: "albumID" },
        ]
      },
      {
        name: "fk_songs_genres",
        using: "BTREE",
        fields: [
          { name: "genreID" },
        ]
      },
    ]
  });
};
