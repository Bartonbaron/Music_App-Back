const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('folderplaylists', {
    folderID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'folders',
        key: 'folderID'
      }
    },
    playlistID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'playlists',
        key: 'playlistID'
      }
    }
  }, {
    sequelize,
    tableName: 'folderplaylists',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "folderID" },
          { name: "playlistID" },
        ]
      },
      {
        name: "playlistID",
        using: "BTREE",
        fields: [
          { name: "playlistID" },
        ]
      },
    ]
  });
};
