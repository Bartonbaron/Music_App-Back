var DataTypes = require("sequelize").DataTypes;
var _albums = require("./albums");
var _creatorprofiles = require("./creatorprofiles");
var _favoritepodcasts = require("./favoritepodcasts");
var _favoritesongs = require("./favoritesongs");
var _folderplaylists = require("./folderplaylists");
var _folders = require("./folders");
var _followers = require("./followers");
var _genres = require("./genres");
var _library = require("./library");
var _libraryalbums = require("./libraryalbums");
var _libraryplaylists = require("./libraryplaylists");
var _playhistory = require("./playhistory");
var _playlistactivities = require("./playlistactivities");
var _playlistcollaborators = require("./playlistcollaborators");
var _playlists = require("./playlists");
var _playlistsongs = require("./playlistsongs");
var _playqueue = require("./playqueue");
var _podcasts = require("./podcasts");
var _reports = require("./reports");
var _roles = require("./roles");
var _songs = require("./songs");
var _streamhistory = require("./streamhistory");
var _topics = require("./topics");
var _users = require("./users");
var _usersonglikes = require("./usersonglikes");

function initModels(sequelize) {
  var albums = _albums(sequelize, DataTypes);
  var creatorprofiles = _creatorprofiles(sequelize, DataTypes);
  var favoritepodcasts = _favoritepodcasts(sequelize, DataTypes);
  var favoritesongs = _favoritesongs(sequelize, DataTypes);
  var folderplaylists = _folderplaylists(sequelize, DataTypes);
  var folders = _folders(sequelize, DataTypes);
  var followers = _followers(sequelize, DataTypes);
  var genres = _genres(sequelize, DataTypes);
  var library = _library(sequelize, DataTypes);
  var libraryalbums = _libraryalbums(sequelize, DataTypes);
  var libraryplaylists = _libraryplaylists(sequelize, DataTypes);
  var playhistory = _playhistory(sequelize, DataTypes);
  var playlistactivities = _playlistactivities(sequelize, DataTypes);
  var playlistcollaborators = _playlistcollaborators(sequelize, DataTypes);
  var playlists = _playlists(sequelize, DataTypes);
  var playlistsongs = _playlistsongs(sequelize, DataTypes);
  var playqueue = _playqueue(sequelize, DataTypes);
  var podcasts = _podcasts(sequelize, DataTypes);
  var reports = _reports(sequelize, DataTypes);
  var roles = _roles(sequelize, DataTypes);
  var songs = _songs(sequelize, DataTypes);
  var streamhistory = _streamhistory(sequelize, DataTypes);
  var topics = _topics(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);
  var usersonglikes = _usersonglikes(sequelize, DataTypes);

  albums.belongsToMany(library, { as: 'libraryID_libraries', through: libraryalbums, foreignKey: "albumID", otherKey: "libraryID" });
  albums.belongsTo(genres, {as: "genre", foreignKey: "genreID"});
  folders.belongsToMany(playlists, { as: 'playlistID_playlists', through: folderplaylists, foreignKey: "folderID", otherKey: "playlistID" });
  library.belongsToMany(albums, { as: 'albumID_albums', through: libraryalbums, foreignKey: "libraryID", otherKey: "albumID" });
  library.belongsToMany(playlists, { as: 'playlistID_playlists_libraryplaylists', through: libraryplaylists, foreignKey: "libraryID", otherKey: "playlistID" });
  playlists.belongsToMany(folders, { as: 'folderID_folders', through: folderplaylists, foreignKey: "playlistID", otherKey: "folderID" });
  playlists.belongsToMany(library, { as: 'libraryID_library_libraryplaylists', through: libraryplaylists, foreignKey: "playlistID", otherKey: "libraryID" });
  playlists.belongsToMany(songs, { as: "songs", through: playlistsongs, foreignKey: "playlistID", otherKey: "songID" });
  songs.belongsToMany(playlists, { as: "playlists", through: playlistsongs, foreignKey: "songID", otherKey: "playlistID" });
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
  songs.belongsTo(genres, { as: "genre", foreignKey: "genreID"});
  genres.hasMany(songs, { as: "songs", foreignKey: "genreID"});
  genres.hasMany(albums, {as: "albums", foreignKey: "genreID"});
  libraryalbums.belongsTo(library, { as: "library", foreignKey: "libraryID"});
  library.hasMany(libraryalbums, { as: "libraryalbums", foreignKey: "libraryID"});
  libraryplaylists.belongsTo(library, { as: "library", foreignKey: "libraryID"});
  library.hasMany(libraryplaylists, { as: "libraryplaylists", foreignKey: "libraryID"});
  folderplaylists.belongsTo(playlists, { as: "playlist", foreignKey: "playlistID"});
  playlists.hasMany(folderplaylists, { as: "folderplaylists", foreignKey: "playlistID"});
  libraryplaylists.belongsTo(playlists, { as: "playlist", foreignKey: "playlistID"});
  playlists.hasMany(libraryplaylists, { as: "libraryplaylists", foreignKey: "playlistID"});
  playlistactivities.belongsTo(playlists, { as: "playlist", foreignKey: "playlistID"});
  playlists.hasMany(playlistactivities, { as: "playlistactivities", foreignKey: "playlistID"});
  playlistsongs.belongsTo(playlists, { as: "playlist", foreignKey: "playlistID"});
  playlists.hasMany(playlistsongs, { as: "playlistsongs", foreignKey: "playlistID"});
  favoritepodcasts.belongsTo(podcasts, { as: "podcast", foreignKey: "podcastID"});
  podcasts.hasMany(favoritepodcasts, { as: "favoritepodcasts", foreignKey: "podcastID"});
  playhistory.belongsTo(podcasts, { as: "podcast", foreignKey: "podcastID"});
  podcasts.hasMany(playhistory, { as: "playhistories", foreignKey: "podcastID"});
  playqueue.belongsTo(podcasts, { as: "podcast", foreignKey: "podcastID"});
  podcasts.hasMany(playqueue, { as: "playqueues", foreignKey: "podcastID"});
  users.belongsTo(roles, { as: "role", foreignKey: "roleID"});
  roles.hasMany(users, { as: "users", foreignKey: "roleID"});
  favoritesongs.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(favoritesongs, { as: "favoritesongs", foreignKey: "songID"});
  playhistory.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(playhistory, { as: "playhistories", foreignKey: "songID"});
  playlistactivities.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(playlistactivities, { as: "playlistactivities", foreignKey: "songID"});
  playlistsongs.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(playlistsongs, { as: "playlistsongs", foreignKey: "songID"});
  playqueue.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(playqueue, { as: "playqueues", foreignKey: "songID"});
  usersonglikes.belongsTo(songs, { as: "song", foreignKey: "songID"});
  songs.hasMany(usersonglikes, { as: "usersonglikes", foreignKey: "songID"});
  streamhistory.belongsTo(users, {as: "user", foreignKey: "userID"});
  podcasts.belongsTo(topics, { as: "topic", foreignKey: "topicID"});
  topics.hasMany(podcasts, { as: "podcasts", foreignKey: "topicID"});
  creatorprofiles.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasOne(creatorprofiles, { as: "creatorprofile", foreignKey: "userID"});
  favoritepodcasts.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(favoritepodcasts, { as: "favoritepodcasts", foreignKey: "userID"});
  favoritesongs.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(favoritesongs, { as: "favoritesongs", foreignKey: "userID"});
  folders.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(folders, { as: "folders", foreignKey: "userID"});
  followers.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(followers, { as: "followers", foreignKey: "userID"});
  library.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasOne(library, { as: "library", foreignKey: "userID"});
  playhistory.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(playhistory, { as: "playhistories", foreignKey: "userID"});
  playlistactivities.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(playlistactivities, { as: "playlistactivities", foreignKey: "userID"});
  playlists.belongsTo(users, { as: "user", foreignKey: "userID"});
  playlists.hasMany(playlistcollaborators, { as: "collaborators", foreignKey: "playlistID" });
  playlistcollaborators.belongsTo(users, { as: "user", foreignKey: "userID" });
  users.hasMany(playlists, { as: "playlists", foreignKey: "userID"});
  playqueue.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(playqueue, { as: "playqueues", foreignKey: "userID"});
  reports.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(reports, { as: "reports", foreignKey: "userID"});
  usersonglikes.belongsTo(users, { as: "user", foreignKey: "userID"});
  users.hasMany(usersonglikes, { as: "usersonglikes", foreignKey: "userID"});
  users.hasMany(streamhistory, {as: "streamhistory", foreignKey: "userID"});

  return {
    albums,
    creatorprofiles,
    favoritepodcasts,
    favoritesongs,
    folderplaylists,
    folders,
    followers,
    genres,
    library,
    libraryalbums,
    libraryplaylists,
    playhistory,
    playlistactivities,
    playlistcollaborators,
    playlists,
    playlistsongs,
    playqueue,
    podcasts,
    reports,
    roles,
    songs,
    streamhistory,
    topics,
    users,
    usersonglikes,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
