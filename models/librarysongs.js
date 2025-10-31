const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('librarysongs', {
    libraryID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'library',
        key: 'libraryID'
      }
    },
    songID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'songs',
        key: 'songID'
      }
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    tableName: 'librarysongs',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "libraryID" },
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
