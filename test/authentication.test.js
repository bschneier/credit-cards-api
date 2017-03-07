let chai = require('chai');
let chaiHttp = require('chai-http');
let sinon = require('sinon');
let sinonChai = require('sinon-chai');
let bcrypt = require('bcryptjs');
let User = require('../src/models/users');
let server = require('./initializeTestApi');

chai.should();
chai.use(chaiHttp);
chai.use(sinonChai);

function invalidRequestAssertions(res) {
  res.should.have.status(400);
  res.body.message.should.equal('invalid request');
  User.findOne.should.not.have.been.called;
}

describe('Authenticate Request', () => {
  beforeEach(() => {
    sinon.spy(User, 'findOne');
  });

  afterEach(() => {
    User.findOne.restore();
  });

  it('should have username', (done) => {
    let request = { password: 'testPassword', rememberMe: false };
    chai.request(server).post('/authenticate').send(request).end((err, res) => {
      invalidRequestAssertions(res);
      done();
    });
  });

  it('should have password', (done) => {
    let request = { userName: 'testUsername', rememberMe: false };
    chai.request(server).post('/authenticate').send(request).end((err, res) => {
      invalidRequestAssertions(res);
      done();
    });
  });

  it('should have rememberMe', (done) => {
    let request = { password: 'testPassword', userName: 'testUsername' };
    chai.request(server).post('/authenticate').send(request).end((err, res) => {
      invalidRequestAssertions(res);
      done();
    });
  });
});

describe('Authenticate Logic', () => {
  beforeEach(() => {
    sinon.stub(User, 'findOne');
  });

  afterEach(() => {
    User.findOne.restore();
  });

  it('authenticates valid credentials', (done) => {
    let testUser = { userName: 'testUser', password: bcrypt.hashSync("testPassword", bcrypt.genSaltSync(10)) };
    User.findOne.yields(null, testUser);
    let request = { userName: 'testUser', password: 'testPassword', rememberMe: false };
    chai.request(server).post('/authenticate').send(request).end((err, res) => {
      res.should.have.status(200);
      res.body.user.userName.should.equal('testUser');
      // TODO: other checks to be done here
      done();
    });
  });
});