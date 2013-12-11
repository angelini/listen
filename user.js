var async  = require('async'),
    bcrypt = require('bcrypt'),
    Song   = require('./song');

var errorHandler = function(handler, callback) {
  return function(err, result) {
    if (err) {
      handler(err);
    } else {
      callback(result);
    }
  };
};

var hashPassword = function(password, callback) {
  bcrypt.genSalt(10, errorHandler(callback, function(salt) {
    bcrypt.hash(password, salt, callback);
  }));
};

var User = function(id, email, password) {
  this.id       = id;
  this.email    = email;
  this.password = password;
};

User.key = function(id) { return ['user', id].join(':'); };

User.feedKey = function(id) { return ['user', id, 'feed'].join(':'); };

User.friendsKey = function(id) { return ['user', id, 'friends'].join(':'); };

User.songsKey = function(id) { return ['user', id, 'songs'].join(':'); };

User.emailsKey = function() { return ['user', 'emails'].join(':'); };

User.generateId = function(db, callback) {
  db.incr('users', callback);
};

User.load = function(db, id, callback) {
  db.hgetall(User.key(id), errorHandler(callback, function(user) {
    if (!user) return callback(null, null);
    callback(null, new User(id, user.email, user.password));
  }));
};

User.loadByEmail = function(db, email, callback) {
  db.hget(User.emailsKey(), email, errorHandler(callback, function(id) {
    User.load(db, id, callback);
  }));
};

User.loadFriends = function(db, id, callback) {
  db.smembers(User.friendsKey(id), errorHandler(callback, function(friendIds) {
    async.map(friendIds,
      function(friendId, callback) {
        return User.load(db, friendId, callback);
      },
      callback);
  }));
};

User.loadFeed = function(db, id, limit, callback) {
  db.lrange(User.feedKey(id), 0, limit, errorHandler(callback, function(songIds) {
    async.map(songIds,
      function(songId, callback) {
        return Song.load(db, songId, callback);
      },
      callback);
  }));
};

User.prototype.postSongToFriends = function(db, songId, targetIds, callback) {
  var self = this;

  db.smemembers(User.friendsKey(this.id), errorHandler(callback, function(friendIds) {
    var validTargets = targetIds.filter(function(targetId) {
      return friendIds.indexOf(targetId) >= 0;
    });

    async.each(friendIds,
      function(friendId, callback) {
        db.lpush(User.feedKey(self.id), songId);
      },
      callback);
  }));
};

User.prototype.addSong = function(db, songId, callback) {
  db.sadd(User.songsKey(this.id), songId, callback);
};

User.prototype.rateSong = function(db, id, rating, callback) {
  var self = this,
      ratingsKey = Song.ratingsKey(id);

  db.hget(ratingsKey, this.id, errorHandler(callback, function(currentRating) {
    if (currentRating !== null) {
      db.hset(ratingsKey, self.id, rating, callback);
    } else {
      callback({status: 403, message: 'Unauthorized'});
    }
  }));
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

  async.parallel([
      function(callback) { User.generateId(db, callback); },
      function(callback) { hashPassword(self.password, callback); }
    ],
    errorHandler(callback, function(results) {
      self.id = results[0];
      self.password = results[1];

      async.parallel([
          function(callback) { db.hset(User.emailsKey(), self.email, self.id, callback); },
          function(callback) { self.update(db, callback); }
        ], callback);
    }));
};

User.prototype.update = function(db, callback) {
  db.hmset(User.key(this.id), this, callback);
};

module.exports = User;
