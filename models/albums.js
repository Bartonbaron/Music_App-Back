const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('albums', {
    albumID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    albumName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    creatorID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'creatorprofiles',
        key: 'creatorID'
      }
    },
    genreID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'genres',
        key: 'genreID'
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    coverURL: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'albums',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "albumID" },
        ]
      },
      {
        name: "creatorID",
        using: "BTREE",
        fields: [
          { name: "creatorID" },
        ]
      },
      {
        name: "genreID",
        using: "BTREE",
        fields: [
          { name: "genreID" },
        ]
      },
    ]
  });
};
