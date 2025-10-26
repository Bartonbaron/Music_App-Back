const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('favorites', {
    favoriteID: {
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
    contentType: {
      type: DataTypes.ENUM('song','podcast','album','playlist'),
      allowNull: false
    },
    contentID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    tableName: 'favorites',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "favoriteID" },
        ]
      },
      {
        name: "userID",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
    ]
  });
};
