const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('podcasts', {
    podcastID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    podcastName: {
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
    topicID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'topics',
        key: 'topicID'
      }
    },
    fileURL: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    coverURL: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    visibility: {
      type: DataTypes.ENUM('public','private','unlisted'),
      allowNull: true,
      defaultValue: "public"
    },
    likeCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    streamCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'podcasts',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "podcastID" },
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
        name: "topicID",
        using: "BTREE",
        fields: [
          { name: "topicID" },
        ]
      },
    ]
  });
};
