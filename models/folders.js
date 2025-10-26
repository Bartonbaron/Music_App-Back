const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('folders', {
    folderID: {
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
    folderName: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'folders',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "folderID" },
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
