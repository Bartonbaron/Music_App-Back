const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('playlists', {
    playlistID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    playlistName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    userID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'userID'
      }
    },
    likesCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    coverURL: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    visibility: {
      type: DataTypes.CHAR(1),
      allowNull: true,
      defaultValue: "P"
    },
    moderationStatus: {
      type: DataTypes.ENUM("ACTIVE", "HIDDEN"),
      allowNull: false,
      defaultValue: "ACTIVE"
    },
    isCollaborative: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }
  }, {
    sequelize,
    tableName: 'playlists',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "playlistID" },
        ]
      },
      {
        name: "fk_playlists_users",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
    ]
  });
};
