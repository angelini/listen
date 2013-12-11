var _       = require('underscore'),
    url     = require('url'),
    http    = require('http'),
    redis   = require('redis'),
    Keygrip = require('keygrip'),
    Cookies = require('cookies'),
    router  = require('./router');

var PORT = 8080;

var db      = redis.createClient(),
    keygrip = new Keygrip(['DEV_KEY']);

var logRequest = function(url, request) {
  console.log([request.method, url.pathname].join(' '));
};

var server = http.createServer(function(request, response) {
  var parsed = url.parse(request.url),
      route  = router.match(parsed.pathname);

  logRequest(parsed, request);

  if (!route) {
    response.writeHead(404);
    return response.end();
  }

  _.extend(route.params, {
    db: db,
    cookies: new Cookies(request, response, keygrip)
  });

  route.fn.call(route.params, request, response);
});

server.listen(PORT);
console.log('Listening on port ' + PORT);
