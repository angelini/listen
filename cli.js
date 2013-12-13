var _      = require('underscore'),
    repl   = require('repl'),
    colors = require('ansicolors'),
    Client = require('./src/Client');

var DEFAULT_LOGIN = {email: 'first@test.com', password: '1234'};

var log = function(lines, color) {
  var concat  = lines.join('\n'),
      message = color ? colors[color](concat) : concat;

  console.log(message);
};

var context = {
  _: _,
  Client: Client,

  c: new Client('127.0.0.1', '8080'),

  login: function() {
    context.c.login(DEFAULT_LOGIN.email, DEFAULT_LOGIN.password, context.p);
  },

  p: function(err, response) {
    if (err) {
      log(['ERROR', JSON.stringify(err, null, 2)], 'red');
    } else {
      log([
        'STATUS: ' + response.status,
        JSON.stringify(response.body, null, 2)
      ]);
    }
  }
};

var cli = repl.start({
  prompt: 'listen> '
});

_.extend(cli.context, context);

cli.on('exit', function() {
  console.log('Exiting.');
  process.exit();
});
