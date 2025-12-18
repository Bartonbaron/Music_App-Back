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
      type: DataTypes.STRING(50),
      allowNull: false
    },
    creatorID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'creatorprofiles',
        key: 'creatorID'
      }
    },
    genreID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "genres",
        key: "genreID"
      }
    },
    moderationStatus: {
      type: DataTypes.ENUM("ACTIVE", "HIDDEN"),
      allowNull: false,
      defaultValue: "ACTIVE"
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: 1
    },
    coverURL: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    releaseDate: {
      type: DataTypes.DATE,
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
        name: "fk_albums_creators",
        using: "BTREE",
        fields: [
          { name: "creatorID" },
        ]
      },
    ]
  });
};
