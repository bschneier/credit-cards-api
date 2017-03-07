let startServer = require('../src/server');

let cookieSecret = 'testCookieSecret';
process.env.TOKEN_SECRET = 'testTokenSecret';
process.env.COOKIE_TOKEN_SECRET = 'testCookieTokenSecret';

let app = startServer(cookieSecret);
module.exports = app;