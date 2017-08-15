const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
let User = require('../src/models/users');
const server = require('../src/server');
const utils = require('./testUtils');
const CONSTANTS = require('../src/constants');

chai.should();
chai.use(chaiHttp);
chai.use(sinonChai);

function setUpMockUser() {
  sinon.stub(User, 'findOne');
  let testUser = {
    username: utils.data.username,
    firstName: utils.data.firstName,
    lastName: utils.data.lastName,
    email: utils.data.email
  };
  User.findOne.yields(null, testUser);
}

// TODO: mongo error cases
describe('GET /profile', () => {
  describe('When user is found', () => {
    afterEach(() => {
      User.findOne.restore();
    });

    it('should return success status and message', (done) => {
      utils.login(server, 'user', (agent) => {
          setUpMockUser();
          return agent.get('/users/profile');
        }, (err, res) => {
            res.should.have.status(CONSTANTS.HTTP_STATUS_CODES.OK);
            res.body.message.should.equal(CONSTANTS.RESPONSE_MESSAGES.SUCCESS);
            done();
      });
    });

    it('should return user info', (done) => {
      utils.login(server, 'user', (agent) => {
          setUpMockUser();
          return agent.get('/users/profile');
        }, (err, res) => {
          res.body.user.username.should.equal(utils.data.username);
          res.body.user.firstName.should.equal(utils.data.firstName);
          res.body.user.lastName.should.equal(utils.data.lastName);
          res.body.user.email.should.equal(utils.data.email);
          done();
      });
    });
  });

  describe('When user is not found', () => {
    it('should return OK status with error message, and error object', (done) => {
      let expectedErrors = [ CONSTANTS.ERRORS.DATA_NOT_FOUND ];
      utils.login(server, 'user', (agent) => {
          sinon.stub(User, 'findOne');
          User.findOne.yields(null, null);
          return agent.get('/users/profile');
        }, (err, res) => {
          res.should.have.status(CONSTANTS.HTTP_STATUS_CODES.OK);
          res.body.message.should.equal(CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND);
          res.body.errors.should.deep.equal(expectedErrors);
          done();
      });
    });
  });
});