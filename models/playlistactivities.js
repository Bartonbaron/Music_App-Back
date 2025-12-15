const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('playlistactivities', {
    activityID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    playlistID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'playlists',
        key: 'playlistID'
      }
    },
    songID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'songs',
        key: 'songID'
      }
    },
    userID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'userID'
      }
    },
    action: {
      type: DataTypes.ENUM('ADD','REMOVE'),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'playlistactivities',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "activityID" },
        ]
      },
      {
        name: "fk_playlistactivities_song",
        using: "BTREE",
        fields: [
          { name: "songID" },
        ]
      },
      {
        name: "idx_playlistactivities_playlist",
        using: "BTREE",
        fields: [
          { name: "playlistID" },
        ]
      },
      {
        name: "idx_playlistactivities_playlist_created",
        using: "BTREE",
        fields: [
          { name: "playlistID" },
          { name: "createdAt" },
        ]
      },
      {
        name: "idx_playlistactivities_user",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
    ]
  });
};
