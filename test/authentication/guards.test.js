const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const jwt = require('jsonwebtoken');
const server = require('../../src/server');
const utils = require('../testUtils');

chai.should();
chai.use(chaiHttp);
chai.use(sinonChai);

// TODO: implement this test
describe('AuthenticationGuard', () => {

});

// TODO: implement this test
describe('AdminGuard', () => {

});