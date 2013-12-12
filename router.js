var _      = require('underscore'),
    async  = require('async'),
    bcrypt = require('bcrypt'),
    Routes = require('routes'),
    User   = require('./user'),
    Song   = require('./song');

var USER_COOKIE = 'user_id';

var writeJSON = function(code, object, response) {
  response.writeHead(code, {'Content-Type': 'application/json'});
  response.end(JSON.stringify(object));
};

var writeError = function(code, message, response) {
  writeJSON(code, {error: message}, response);
};

var readPostData = function(request, response, callback) {
  if (request.method != 'POST') {
    return callback({status: 400, message: 'POST Required'});
  }

  var body = '';

  request.on('data', function(chunk) {
    body += chunk;
  });

  request.on('end', function() {
    try {
      request.body = JSON.parse(body);
      callback(null);

    } catch (e) {
      callback(e);
    }
  });
};

var requireLogin = function(request, response, callback) {
  request.userId = this.cookies.get(USER_COOKIE, {signed: true});

  if (request.userId) {
    callback();
  } else {
    callback({status: 401, message: 'Login Required'});
  }
};

var before = function(filters, callback) {
  return function(request, response) {
    var self = this,
        wrappedFilters = _.map(filters, function(filter) {
          return function(callback) { filter.call(self, request, response, callback); };
        });

    async.series(wrappedFilters, function(err) {
      if (err) {
        return writeError(err.status || 500, err.message || '', response);
      }

      callback.call(self, request, response);
    });
  };
};

var errorHandler = function(response, callback) {
  return function(err, result) {
    if (err) {
      writeError(err.status || 500, err.message || '', response);
    } else {
      callback(result);
    }
  };
};

var router = Routes();

router.addRoute('/api/users', before([readPostData], function(request, response) {
  var self = this;

  if (!request.body.email || !request.body.password) {
    return writeError(400, 'Email and Password Required', response);
  }

  User.loadByEmail(this.db, this.email, errorHandler(response, function(existingUser) {
    if (existingUser) {
      return writeError(400, 'Email Already Exists', response);
    }

    var user = new User(null, request.body.email, request.body.password);
    user.save(self.db, errorHandler(response, function() {
      writeJSON(201, {id: user.id}, response);
    }));
  }));
}));

router.addRoute('/api/users/login', before([readPostData], function(request, response) {
  var self = this;

  if (!request.body.email || !request.body.email) {
    return writeError(400, 'Email and Password Required', response);
  }

  User.loadByEmail(this.db, request.body.email, errorHandler(response, function(user) {
    bcrypt.compare(request.body.password, user.password, errorHandler(response, function(result) {
      if (result) {
        self.cookies.set(USER_COOKIE, user.id, {signed: true});
        writeJSON(200, {id: user.id}, response);
      } else {
        writeError(401, 'Wrong Password', response);
      }
    }));
  }));
}));

router.addRoute('/api/users/:id/feed', before([requireLogin], function(request, response) {
  if (request.userId != this.id) {
    return writeError(403, 'Unauthorized', response);
  }

  User.loadFeed(this.db, this.id, 100, errorHandler(response, function(songs) {
    writeJSON(200, songs, response);
  }));
}));

router.addRoute('/api/users/:id/friends', before([requireLogin], function(request, response) {
  if (request.userId != this.id) {
    return writeError(403, 'Unauthorized', response);
  }

  User.loadFriends(this.db, this.id, errorHandler(response, function(friends) {
    writeJSON(200, friends, response);
  }));
}));

router.addRoute('/api/users/:id/friends/add', before([requireLogin, readPostData], function(request, response) {
  if (request.userId != this.id) {
    return writeError(403, 'Unauthorized', response);
  }

  if (!request.body.friend) {
    return writeError(400, 'Friend ID Required', response);
  }

  var user = new User(request.userId);
  user.addFriend(this.db, request.body.friend, errorHandler(response, function() {
    writeJSON(201, {}, response);
  }));
}));

router.addRoute('/api/users/:id/friends/:friendId/accept', before([requireLogin], function(request, response) {
  if (request.method != 'POST') {
    return writeError(400, 'POST Required', response);
  }

  if (request.userId != this.id) {
    return writeError(403, 'Unauthorized', response);
  }

  var user = new User(request.userId);
  user.acceptFriend(this.db, this.friendId, errorHandler(response, function(wasAccepted) {
    if (wasAccepted) {
      writeJSON(201, {}, response);
    } else {
      writeError(404, 'Friend Request Not Found', response);
    }
  }));
}));

router.addRoute('/api/songs', before([requireLogin, readPostData], function(request, response) {
  var self = this,
      ratings = {};

  if (!request.body.url || !request.body.friends) {
    return writeError(400, 'URL and Friends Required', response);
  }

  request.body.friends.forEach(function(friend) {
    ratings[friend] = 0;
  });

  var user = new User(request.userId),
      song = new Song(null, request.body.url, request.userId, ratings);

  song.save(this.db, errorHandler(response, function() {
    async.parallel([
        function(callback) { user.addSong(self.db, song.id, callback); },
        function(callback) { user.postSongToFriends(self.db, song.id, request.body.friends, callback); }
      ],
      errorHandler(response, function() {
        writeJSON(201, {}, response);
      }));
  }));
}));

router.addRoute('/api/songs/:id/up', before([requireLogin], function(request, response) {
  var user = new User(request.userId);

  user.rateSong(this.id, 1, errorHandler(response, function() {
    writeJSON(201, {}, response);
  }));
}));

router.addRoute('/api/songs/:id/down', before([requireLogin], function(request, response) {
  var user = new User(request.userId);

  user.rateSong(this.id, -1, errorHandler(response, function() {
    writeJSON(201, {}, response);
  }));
}));

module.exports = router;
