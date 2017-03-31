const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
let bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
let User = require('../src/models/users');
const setTestRedisClient = require('./setTestRedisClient');
const server = require('../src/server');
const utils = require('./testUtils');

chai.should();
chai.use(chaiHttp);
chai.use(sinonChai);

function invalidRequestAssertions(res) {
  res.should.have.status(400);
  res.body.message.should.equal('invalid request');
  User.findOne.should.not.have.been.called;
}

// TODO: mongo error cases
describe('POST /authenticate', () => {
  describe('Request Validation', () => {
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

  describe('For valid credentials', () => {
    let request;
    const userName = utils.data.userName;
    const role = 'user';
    const groupId = 1;

    beforeEach(() => {
      sinon.stub(User, 'findOne');
      const password = 'testPassword';
      let testUser = {
        userName: userName,
        password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
        role: role,
        groupId: groupId
      };
      User.findOne.yields(null, testUser);
      request = { userName: userName, password: password, rememberMe: false };
    });

    afterEach(() => {
      User.findOne.restore();
    });

    it('Should return success status and message', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        res.should.have.status(200);
        res.body.message.should.equal('login success');
        done();
      });
    });

    it('Should return username in body', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        res.body.user.userName.should.equal(userName);
        done();
      });
    });

    it('Should call mongodb to find user', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        User.findOne.should.have.been.calledOnce;
        done();
      });
    });

    it('Should set cookie expiration and httponly', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        res.should.have.cookie('credit-cards-session');
        res.should.have.cookie('credit-cards-session.sig');
        let resDate = Date.parse(res.headers.date);
        res.headers['set-cookie'].forEach((value) => {
          let cookieDate = Date.parse(value.split('; ')[2].replace('expires=', ''));
          ((cookieDate - resDate) / 1000).should.be.closeTo(1200, 1);
          value.split('; ')[3].should.equal('httponly');
        });
        done();
      });
    });

    it('Should set token in header', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        let headerToken = jwt.verify(res.body.token, process.env.TOKEN_SECRET);
        (headerToken.exp - headerToken.iat).should.equal(1200);
        headerToken.userName.should.equal(userName);
        headerToken.role.should.equal(role);
        headerToken.groupId.should.equal(groupId);
        done();
      });
    });
  });

  // TODO: implement this test
  describe('For invalid credentials', () => {

    // TODO: test for locking users out
  });
});


// TODO: implement this test
describe('AuthGuard', () => {

});

// TODO: implement this test
describe('AdminGuard', () => {

});