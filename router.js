var async  = require('async'),
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
    var wrappedFilters = _.map(filters, function(filter) {
      return function(callback) { filter(request, response, callback); };
    });

    async.series(wrappedFilters, function(err) {
      if (err) {
        return writeError(err.status || 500, err.message || '', response);
      }

      callback(request, response);
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

var router = Router();

router.addRoute('/api/users/create', before([readPostData], function(request, response) {
  if (!this.email || !this.password) {
    return writeError(400, 'Email and Password Required');
  }

  User.loadByEmail(this.db, this.email, errorHandler(response, function(existingUser) {
    if (existingUser) {
      return writeError(400, 'Email Already Exists');
    }

    var user = new User(null, self.email, self.password);
    user.save(errorHandler(response, function(user) {
      writeJSON(201, {id: user.id}, response);
    }));
  }));
}));

router.addRoute('/api/users/:id/login', before([readPostData], function(request, response) {
  var self = this;

  if (!this.email || !this.email) {
    return writeError(400, 'Email and Password Required');
  }

  User.loadByEmail(this.db, this.email, errorHandler(response, function(user) {
    bcrypt.compare(self.password, user.password, errorHandler(function(result) {
      if (result) {
        self.cookies.set(USER_COOKIE, user.id, {signed: true});
        writeJSON(200, user, response);
      } else {
        writeError(401, 'Wrong Password', response);
      }
    }));
  }));
}));

router.addRoute('/api/users/:id/feed', before([requireLogin], function(request, response) {
  if (this.userId != this.id) {
    return writeError(403, 'Unauthorized', response);
  }

  User.loadFeed(this.db, this.id, errorHandler(response, function(songs) {
    writeJSON(200, songs, response);
  }));
}));

router.addRoute('/api/users/:id/friends', before([requireLogin], function(request, response) {
  if (this.userId != this.id) {
    return writeError(403, 'Unauthorized', response);
  }

  User.loadFriends(this.db, this.id, errorHandler(response, function(friends) {
    writeJSON(200, friends, response);
  }));
}));

router.addRoute('/api/songs/post', before([requireLogin, readPostData], function(request, response) {
  var self = this,
      ratings = {};

  if (!this.url || !this.friends) {
    return writeError(400, 'URL and Friends Required');
  }

  this.friends.forEach(function(friend) {
    ratings[friend] = 0;
  });

  var user = new User(this.userId),
      song = new Song(null, this.url, this.userId, ratings);

  song.save(this.db, errorHandler(function(song) {
    async.parallel([
        function(callback) { user.addSong(self.db, song.id, callback); },
        function(callback) { user.postSongToFriend(self.db, song.id, self.friends, callback); }
      ],
      errorHandler(function() {
        writeJSON(201, {}, response);
      }));
  }));
}));

router.addRoute('/api/songs/:id/up', before([requireLogin], function(request, response) {
  var user = new User(this.userId);

  user.rateSong(this.id, 1, errorHandler(function() {
    writeJSON(201, {}, response);
  }));
}));

router.addRoute('/api/songs/:id/down', before([requireLogin], function(request, response) {
  var user = new User(this.userId);

  user.rateSong(this.id, -1, errorHandler(function() {
    writeJSON(201, {}, response);
  }));
}));

modules.exports = router;
