var async = require('async');

var Song = function(id, url, userId, ratings) {
  this.id      = id;
  this.url     = url;
  this.userId  = userId;
  this.ratings = ratings;
};

Song.key = function(id) { return ['song', id].join(':'); };

Song.ratingsKey = function(id) { return ['song', id, 'ratings'].join(':'); };

Song.generateId = function(db, callback) {
  db.incr('songs', callback);
};

Song.load = function(db, id, callback) {
  async.parallel([
      function(callback) { db.hgetall(Song.key(id), callback); },
      function(callback) { db.hgetall(Song.ratingsKey(id), callback); }
    ],
    function(err, results) {
      callback(err, new Song(id, results[0].url, results[0].userId, results[1] || {}));
    });
};

Song.prototype.toStorage = function() {
  return {id: this.id, url: this.url, userId: this.userId};
};

Song.prototype.save = function(db, callback) {
  if (!this.id) {
    this.create(db, callback);
  } else {
    this.update(db, callback);
  }
};

Song.prototype.create = function(db, callback) {
  var self = this;

  Song.generateId(db, function(err, id) {
    self.id = id;
    self.update(db, callback);
  });
};

Song.prototype.update = function(db, callback) {
  async.parallel([
      function(callback) { db.hmset(Song.key(this.id), this.toStorage()); },
      function(callback) { db.hmset(Song.ratingsKey(this.id), this.ratings); }
    ], callback);
};

module.exports = Song;
