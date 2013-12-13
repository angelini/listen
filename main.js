var Server = require('./src/Server.js');

(new Server({port: 8080})).start();

console.log('Listening on port 8080');
