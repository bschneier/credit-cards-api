const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
let User = require('../src/models/users');
const server = require('../src/server');
const utils = require('./testUtils');

chai.should();
chai.use(chaiHttp);
chai.use(sinonChai);

function setUpMockUser() {
  sinon.stub(User, 'findOne');
  let testUser = {
    userName: utils.data.userName,
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
      let agent = utils.login(server, 'user', (agent, token) => {
        setUpMockUser();
        agent.get('/users/profile').set('credit-cards-authentication', token).end((err, res) => {
          res.should.have.status(200);
          res.body.message.should.equal('user found successfully');
          done();
        });
      });
    });

    it('should return user info', (done) => {
      let agent = utils.login(server, 'user', (agent, token) => {
        setUpMockUser();
        agent.get('/users/profile').set('credit-cards-authentication', token).end((err, res) => {
          res.body.user.userName.should.equal(utils.data.userName);
          res.body.user.firstName.should.equal(utils.data.firstName);
          res.body.user.lastName.should.equal(utils.data.lastName);
          res.body.user.email.should.equal(utils.data.email);
          done();
        });
      });
    });
  });

  // TODO: finalize this behavior
  describe('When user is not found', () => {
    it('should return error message', (done) => {
      let agent = utils.login(server, 'user', (agent, token) => {
        sinon.stub(User, 'findOne');
        User.findOne.yields(null, null);
        agent.get('/users/profile').set('credit-cards-authentication', token).end((err, res) => {
            res.should.have.status(200);
            res.body.message.should.equal('user not found');
            done();
          });
      });
    });
  });
});