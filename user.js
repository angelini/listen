var async = require('async'),
    Song  = require('./song');

var User = function(id, email, password) {
  this.id       = id;
  this.email    = email;
  this.password = password;
};

User.key = function(id) { return ['user', id].join(':'); };

User.feedKey = function(id) { return ['user', id, 'feed'].join(':'); };

User.friendsKey = function(id) { return ['user', id, 'friends'].join(':'); };

User.songsKey = function(id) { return ['user', id, 'songs'].join(':'); };

User.generateId = function(db, callback) {
  db.incr('users', callback);
};

User.load = function(db, id, callback) {
  db.hgetall(User.key(id), function(err, user) {
    callback(err, new User(id, user.email, user.password));
  });
};

User.loadFriends = function(db, id, callback) {
  db.smembers(User.friendsKey(id), function(err, friendIds) {
    async.map(friendIds,
      function(friendId, callback) {
        return User.load(db, friendId, callback);
      },
      callback);
  });
};

User.loadFeed = function(db, id, limit, callback) {
  db.lrange(User.feedKey(id), 0, limit, function(err, songIds) {
    async.map(songIds,
      function(songId, callback) {
        return Song.load(db, songId, callback);
      },
      callback);
  });
};

User.prototype.postSongToFriends = function(db, song, friendIds, callback) {
  var self = this;

  async.each(friendIds,
      function(friendId, callback) {
        db.lpush(User.feedKey(self.id), song.id);
      },
      callback);
};

User.prototype.addSong = function(db, song, callback) {
  db.sadd(User.songsKey(this.id), song.id, callback);
};

User.prototype.rateSong = function(db, id, rating, callback) {
  db.hset(Song.ratingsKey(id), this.id, rating, callback);
};

User.prototype.save = function(db, callback) {
  if (!this.id) {
    this.create(db, callback);
  } else {
    this.update(db, callback);
  }
};

User.prototype.create = function(db, callback) {
  var self = this;

  User.generateId(db, function(err, id) {
    self.id = id;
    self.update(db, callback);
  });
};

User.prototype.update = function(db, callback) {
  db.hmset(User.key(this.id), this, callback);
};

module.exports = User;
