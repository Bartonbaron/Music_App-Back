const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('librarypodcasts', {
    libraryID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'library',
        key: 'libraryID'
      }
    },
    podcastID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'podcasts',
        key: 'podcastID'
      }
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    tableName: 'librarypodcasts',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "libraryID" },
          { name: "podcastID" },
        ]
      },
      {
        name: "podcastID",
        using: "BTREE",
        fields: [
          { name: "podcastID" },
        ]
      },
    ]
  });
};
