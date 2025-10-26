const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('libraryplaylists', {
    libraryID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'library',
        key: 'libraryID'
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
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    tableName: 'libraryplaylists',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "libraryID" },
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
