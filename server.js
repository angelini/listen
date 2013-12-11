var _      = require('underscore'),
    url    = require('url'),
    http   = require('http'),
    redis  = require('redis'),
    router = require('./router');

var db = redis.createClient();

var server = http.createServer(function(request, response) {
  var parsed = url.parse(request.url),
      route  = router.match(parsed.pathname);

  if (!route) {
    response.writeHead(404);
    response.end();
    return;
  }

  _.extend(route.params, {db: db});

  route.fn.apply(route.params, request, response);
});

server.listen(8080);
