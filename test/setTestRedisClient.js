const fakeRedis = require('fakeredis');
const setRedisClient = require('../src/routes/authentication').setRedisClient;

setRedisClient(fakeRedis.createClient());