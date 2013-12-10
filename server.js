var url    = require('url'),
    http   = require('http'),
    async  = require('async'),
    Routes = require('routes');

var Song = function(id, url, ratings) {
  this.id      = id;
  this.url     = url;
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
      callback(err, new Song(id), results[0].url, results[1] || {});
    });
};

Song.prototype.toStorage = function() {
  return {id: this.id, url: this.url};
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

var User = function(id, email, password) {
  this.id       = id;
  this.email    = email;
  this.password = password;
};

User.key = function(id) { return ['user', id].join(':'); };

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
        User.load(db, friendId, callback);
      },
      callback);
  });
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

var router = Router();

var writeJSON = function(code, object, response) {
  response.writeHead(code);
  response.end(JSON.stringify(object));
};

var errorHandler = function(response, callback) {
  return function(err, result) {
    if (err) {
      response.writeHead(500);
      response.end();
    } else {
      callback(result);
    }
  };
};

router.addRoute('/users/:id/friends', function(request, response) {
  User.loadFriends(this.db, this.id,
    errorHandler(response, function(friends) {
      writeJSON(200, friends, response);
    }));
});

var server = http.createServer(function(request, response) {
  var parsed = url.parse(request.url),
      route  = router.match(parsed.pathname);

  if (!route) {
    response.writeHead(404);
    response.end();
    return;
  }

  route.fn.apply(route.params, request, response);
});

server.listen(8080);
