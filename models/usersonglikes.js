const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('usersonglikes', {
    id: {
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
    }
  }, {
    sequelize,
    tableName: 'usersonglikes',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "unique_user_song",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "userID" },
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
