const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const jwt = require('jsonwebtoken');
let moment = require('moment');
const config = require('config');
let User = require('../../src/models/users');
const setTestRedisClient = require('../setTestRedisClient');
const server = require('../../src/server');
const utils = require('../testUtils');

chai.should();
chai.use(chaiHttp);
chai.use(sinonChai);

// TODO: implement this test
describe('GET /authenticate', () => {
  // TODO: test that locked out users cannot get session with valid rememberMe token
});