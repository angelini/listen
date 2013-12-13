var _       = require('underscore'),
    url     = require('url'),
    http    = require('http'),
    redis   = require('redis'),
    Keygrip = require('keygrip'),
    Cookies = require('cookies'),
    Router  = require('./router');

var connectToRedis = function(config) {
  if (!config.redis) config.redis = {};

  return redis.createClient(
    config.redis.port   || 6379,
    config.redis.host   || '127.0.0.1',
    config.redis.opions || {}
  );
};

var buildKeygrip = function(config) {
  if (!config.keys) console.warn('Dev Mode');
  return new Keygrip(config.keys || ['DEV_KEY']);
};

var logRequest = function(url, request) {
  console.log([request.method, url.pathname].join(' '));
};

var Server = function(config) {
  this.config  = config;
  this.db      = connectToRedis(config);
  this.keygrip = buildKeygrip(config);
  this.router  = new Router();
};

Server.prototype.create = function() {
  var self = this;

  this._server = http.createServer(function(request, response) {
    var parsed = url.parse(request.url),
        route  = self.router.match(parsed.pathname);

    logRequest(parsed, request);

    if (!route) {
      response.writeHead(404);
      return response.end();
    }

    _.extend(route.params, {
      db: self.db,
      cookies: new Cookies(request, response, self.keygrip)
    });

    route.fn.call(route.params, request, response);
  });

  return this._server;
};

Server.prototype.start = function() {
  this.create().listen(this.config.port);
};

module.exports = Server;
