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
      allowNull: true,
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
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    releaseDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    moderationStatus: {
      type: DataTypes.ENUM("ACTIVE", "HIDDEN"),
      allowNull: false,
      defaultValue: "ACTIVE"
    },
    streamCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    coverURL: {
      type: DataTypes.STRING(255),
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
        name: "fk_podcasts_creators",
        using: "BTREE",
        fields: [
          { name: "creatorID" },
        ]
      },
      {
        name: "fk_podcasts_topics",
        using: "BTREE",
        fields: [
          { name: "topicID" },
        ]
      },
    ]
  });
};
