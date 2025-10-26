var DataTypes = require("sequelize").DataTypes;
var _albums = require("./albums");
var _creatorprofiles = require("./creatorprofiles");
var _favorites = require("./favorites");
var _folderplaylists = require("./folderplaylists");
var _folders = require("./folders");
var _followers = require("./followers");
var _genres = require("./genres");
var _library = require("./library");
var _libraryalbums = require("./libraryalbums");
var _libraryplaylists = require("./libraryplaylists");
var _librarypodcasts = require("./librarypodcasts");
var _librarysongs = require("./librarysongs");
var _playhistory = require("./playhistory");
var _playlists = require("./playlists");
var _playlistsongs = require("./playlistsongs");
var _playqueue = require("./playqueue");
var _podcasts = require("./podcasts");
var _recommendations = require("./recommendations");
var _roles = require("./roles");
var _songs = require("./songs");
var _topics = require("./topics");
var _users = require("./users");

function initModels(sequelize) {
  var albums = _albums(sequelize, DataTypes);
  var creatorprofiles = _creatorprofiles(sequelize, DataTypes);
  var favorites = _favorites(sequelize, DataTypes);
  var folderplaylists = _folderplaylists(sequelize, DataTypes);
  var folders = _folders(sequelize, DataTypes);
  var followers = _followers(sequelize, DataTypes);
  var genres = _genres(sequelize, DataTypes);
  var library = _library(sequelize, DataTypes);
  var libraryalbums = _libraryalbums(sequelize, DataTypes);
  var libraryplaylists = _libraryplaylists(sequelize, DataTypes);
  var librarypodcasts = _librarypodcasts(sequelize, DataTypes);
  var librarysongs = _librarysongs(sequelize, DataTypes);
  var playhistory = _playhistory(sequelize, DataTypes);
  var playlists = _playlists(sequelize, DataTypes);
  var playlistsongs = _playlistsongs(sequelize, DataTypes);
  var playqueue = _playqueue(sequelize, DataTypes);
  var podcasts = _podcasts(sequelize, DataTypes);
  var recommendations = _recommendations(sequelize, DataTypes);
  var roles = _roles(sequelize, DataTypes);
  var songs = _songs(sequelize, DataTypes);
  var topics = _topics(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);

  albums.belongsToMany(library, { as: 'libraryID_libraries', through: libraryalbums, foreignKey: "albumID", otherKey: "libraryID" });
  folders.belongsToMany(playlists, { as: 'playlistID_playlists', through: folderplaylists, foreignKey: "folderID", otherKey: "playlistID" });
  library.belongsToMany(albums, { as: 'albumID_albums', through: libraryalbums, foreignKey: "libraryID", otherKey: "albumID" });
  library.belongsToMany(playlists, { as: 'playlistID_playlists_libraryplaylists', through: libraryplaylists, foreignKey: "libraryID", otherKey: "playlistID" });
  library.belongsToMany(podcasts, { as: 'podcastID_podcasts', through: librarypodcasts, foreignKey: "libraryID", otherKey: "podcastID" });
  library.belongsToMany(songs, { as: 'songID_songs', through: librarysongs, foreignKey: "libraryID", otherKey: "songID" });
  playlists.belongsToMany(folders, { as: 'folderID_folders', through: folderplaylists, foreignKey: "playlistID", otherKey: "folderID" });
  playlists.belongsToMany(library, { as: 'libraryID_library_libraryplaylists', through: libraryplaylists, foreignKey: "playlistID", otherKey: "libraryID" });
  playlists.belongsToMany(songs, { as: 'songID_songs_playlistsongs', through: playlistsongs, foreignKey: "playlistID", otherKey: "songID" });
  podcasts.belongsToMany(library, { as: 'libraryID_library_librarypodcasts', through: librarypodcasts, foreignKey: "podcastID", otherKey: "libraryID" });
  songs.belongsToMany(library, { as: 'libraryID_library_librarysongs', through: librarysongs, foreignKey: "songID", otherKey: "libraryID" });
  songs.belongsToMany(playlists, { as: 'playlistID_playlists_playlistsongs', through: playlistsongs, foreignKey: "songID", otherKey: "playlistID" });
  libraryalbums.belongsTo(albums, { as: "album", foreignKey: "albumID"});
  albums.hasMany(libraryalbums, { as: "libraryalbums", foreignKey: "albumID"});
  songs.belongsTo(albums, { as: "album", foreignKey: "albumID"});
  albums.hasMany(songs, { as: "songs", foreignKey: "albumID"});
  albums.belongsTo(creatorprofiles, { as: "creator", foreignKey: "creatorID"});
  creatorprofiles.hasMany(albums, { as: "albums", foreignKey: "creatorID"});
  followers.belongsTo(creatorprofiles, { as: "creator", foreignKey: "creatorID"});
  creatorprofiles.hasMany(followers, { as: "followers", foreignKey: "creatorID"});
  podcasts.belongsTo(creatorprofiles, { as: "creator", foreignKey: "creatorID"});
  creatorprofiles.hasMany(podcasts, { as: "podcasts", foreignKey: "creatorID"});
  songs.belongsTo(creatorprofiles, { as: "creator", foreignKey: "creatorID"});
  creatorprofiles.hasMany(songs, { as: "songs", foreignKey: "creatorID"});
  folderplaylists.belongsTo(folders, { as: "folder", foreignKey: "folderID"});
  folders.hasMany(folderplaylists, { as: "folderplaylists", foreignKey: "folderID"});
  albums.belongsTo(genres, { as: "genre", foreignKey: "genreID"});
  genres.hasMany(albums, { as: "albums", foreignKey: "genreID"});
  songs.belongsTo(genres, { as: "genre", foreignKey: "genreID"});
  genres.hasMany(songs, { as: "songs", foreignKey: "genreID"});
  libraryalbums.belongsTo(library, { as: "library", foreignKey: "libraryID"});
  library.hasMany(libraryalbums, { as: "libraryalbums", foreignKey: "libraryID"});
  libraryplaylists.belongsTo(library, { as: "library", foreignKey: "libraryID"});
  library.hasMany(libraryplaylists, { as: "libraryplaylists", foreignKey: "libraryID"});
  librarypodcasts.belongsTo(library, { as: "library", foreignKey: "libraryID"});
  library.hasMany(librarypodcasts, { as: "librarypodcasts", foreignKey: "libraryID"});
  librarysongs.belongsTo(library, { as: "library", foreignKey: "libraryID"});
  library.hasMany(librarysongs, { as: "librarysongs", foreignKey: "libraryID"});
  folderplaylists.belongsTo(playlists, { as: "playlist", foreignKey: "playlistID"});
  playlists.hasMany(folderplaylists, { as: "folderplaylists", foreignKey: "playlistID"});
  libraryplaylists.belongsTo(playlists, { as: "playlist", foreignKey: "playlistID"});
  playlists.hasMany(libraryplaylists, { as: "libraryplaylists", foreignKey: "playlistID"});
  playlistsongs.belongsTo(playlists, { as: "playlist", foreignKey: "playlistID"});
  playlists.hasMany(playlistsongs, { as: "playlistsongs", foreignKey: "playlistID"});
  librarypodcasts.belongsTo(podcasts, { as: "podcast", foreignKey: "podcastID"});
  podcasts.hasMany(librarypodcasts, { as: "librarypodcasts", foreignKey: "podcastID"});
  users.belongsTo(roles, { as: "role", foreignKey: "roleID"});
  roles.hasMany(users, { as: "users", foreignKey: "roleID"});
  librarysongs.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(librarysongs, { as: "librarysongs", foreignKey: "songID"});
  playlistsongs.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(playlistsongs, { as: "playlistsongs", foreignKey: "songID"});
  recommendations.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(recommendations, { as: "recommendations", foreignKey: "songID"});
  podcasts.belongsTo(topics, { as: "topic", foreignKey: "topicID"});
  topics.hasMany(podcasts, { as: "podcasts", foreignKey: "topicID"});
  creatorprofiles.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(creatorprofiles, { as: "creatorprofiles", foreignKey: "userID"});
  favorites.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(favorites, { as: "favorites", foreignKey: "userID"});
  folders.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(folders, { as: "folders", foreignKey: "userID"});
  followers.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(followers, { as: "followers", foreignKey: "userID"});
  library.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(library, { as: "libraries", foreignKey: "userID"});
  playhistory.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(playhistory, { as: "playhistories", foreignKey: "userID"});
  playlists.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(playlists, { as: "playlists", foreignKey: "userID"});
  playqueue.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(playqueue, { as: "playqueues", foreignKey: "userID"});
  recommendations.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(recommendations, { as: "recommendations", foreignKey: "userID"});

  return {
    albums,
    creatorprofiles,
    favorites,
    folderplaylists,
    folders,
    followers,
    genres,
    library,
    libraryalbums,
    libraryplaylists,
    librarypodcasts,
    librarysongs,
    playhistory,
    playlists,
    playlistsongs,
    playqueue,
    podcasts,
    recommendations,
    roles,
    songs,
    topics,
    users,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
