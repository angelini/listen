var _       = require('underscore'),
    url     = require('url'),
    path    = require('path'),
    request = require('request');

var Client = function(host, port) {
  this.jar     = request.jar();
  this.request = request.defaults({jar: this.jar});
  this.base    = {
    protocol: 'http:',
    hostname: host,
    port: port
  };
};

Client.prototype.root = function() { return [this.domain, this.port].join(':'); };

Client.prototype.apiURL = function() {
  var args     = Array.prototype.slice.call(arguments),
      strArgs  = args.map(function(a) { return a.toString(); }),
      segments = ['/api'].concat(strArgs);

  return url.format(_.extend({}, this.base, {
    pathname: path.join.apply(this, segments)
  }));
};

Client.prototype.login = function(email, password, callback) {
  var self = this;

  this.request({
    uri: this.apiURL('users', 'login'),
    method: 'POST',
    json: {email: email, password: password}
  }, function (err, response, body) {
    if (!err && body) self.userId = body.id;
    callback(err, response, body);
  });
};

Client.prototype.create = function(email, password, callback) {
  this.request({
    uri: this.apiURL('users', 'create'),
    method: 'POST',
    json: {email: email, password: password}
  }, callback);
};

Client.prototype.feed = function(callback) {
  this.request({
    uri: this.apiURL('users', this.userId, 'feed')
  }, callback);
};

Client.prototype.friends = function(callback) {
  this.request({
    uri: this.apiURL('users', this.userId, 'friends')
  }, callback);
};

module.exports = Client;