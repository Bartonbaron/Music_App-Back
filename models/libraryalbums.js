const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('libraryalbums', {
    libraryID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'library',
        key: 'libraryID'
      }
    },
    albumID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'albums',
        key: 'albumID'
      }
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    tableName: 'libraryalbums',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "libraryID" },
          { name: "albumID" },
        ]
      },
      {
        name: "albumID",
        using: "BTREE",
        fields: [
          { name: "albumID" },
        ]
      },
    ]
  });
};
