const config = require('config');
const mongoose = require('mongoose');
const redis = require('redis');

const startServer = require('./server');
const setRedisClient = require('./routes/authentication').setRedisClient;

// create redis client
const redisConfig = config.get('redisConfig');
const redisClient = redis.createClient(redisConfig.port, redisConfig.host);
setRedisClient(redisClient);

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = Promise;

// connect to mongoDB
const dbConfig = config.get('dbConfig');
mongoose.connect('mongodb://' + dbConfig.username
+ ':' + dbConfig.password + '@' + dbConfig.host
+ ':' + dbConfig.port + '/' + dbConfig.database
+ '?authSource=admin');

startServer();