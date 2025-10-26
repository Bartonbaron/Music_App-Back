const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('library', {
    libraryID: {
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
    }
  }, {
    sequelize,
    tableName: 'library',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "libraryID" },
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
