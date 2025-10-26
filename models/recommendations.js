const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('recommendations', {
    recommendationID: {
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
    songID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'songs',
        key: 'songID'
      }
    },
    score: {
      type: DataTypes.DECIMAL(5,2),
      allowNull: false,
      defaultValue: 0.00
    }
  }, {
    sequelize,
    tableName: 'recommendations',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "recommendationID" },
        ]
      },
      {
        name: "userID",
        using: "BTREE",
        fields: [
          { name: "userID" },
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
