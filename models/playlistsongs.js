const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('playlistsongs', {
    playlistID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'playlists',
        key: 'playlistID'
      }
    },
    songID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'songs',
        key: 'songID'
      }
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    tableName: 'playlistsongs',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "playlistID" },
          { name: "songID" },
        ]
      },
      {
        name: "songID",
        using: "BTREE",
        fields: [
          { name: "songID" },
        ]
      },
    ]
  });
};
