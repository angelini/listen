var Routes = require('routes'),
    User   = require('./user'),
    Song   = require('./song');

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

var router = Router();

router.addRoute('/api/users/:id/feed', function(request, response) {
  User.loadFeed(this.db, this.id,
    errorHandler(response, function(songs) {
      writeJSON(200, songs, response);
    }));
});

router.addRoute('/api/users/:id/friends', function(request, response) {
  User.loadFriends(this.db, this.id,
    errorHandler(response, function(friends) {
      writeJSON(200, friends, response);
    }));
});

router.

modules.exports = router;
