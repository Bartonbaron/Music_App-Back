const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('playhistory', {
    historyID: {
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
      type: DataTypes.ENUM('song','podcast'),
      allowNull: false
    },
    contentID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    playedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    },
    playDuration: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'playhistory',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "historyID" },
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
