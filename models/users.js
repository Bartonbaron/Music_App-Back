const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('users', {
    userID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    userName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    roleID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'roleID'
      }
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: 1
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    profilePicURL: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
      {
        name: "roleID",
        using: "BTREE",
        fields: [
          { name: "roleID" },
        ]
      },
    ]
  });
};
