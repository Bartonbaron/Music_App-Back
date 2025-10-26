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
    contentType: {
      type: DataTypes.ENUM('song','podcast'),
      allowNull: false
    },
    contentID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    isCurrent: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: 0
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
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
    ]
  });
};
