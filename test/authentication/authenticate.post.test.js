const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
let User = require('../../src/models/users');
const setTestRedisClient = require('../setTestRedisClient');
const server = require('../../src/server');
const utils = require('../testUtils');
const CONSTANTS = require('../../src/constants');
const testUtils = require('../testUtils');

chai.should();
chai.use(chaiHttp);
chai.use(sinonChai);

const password = 'testPassword';
let request;
const userName = utils.data.userName;
const firstName = utils.data.firstName;
const role = 'user';
const groupId = 1;
const userId = 1234;
let testUser;

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
      request = { password: 'testPassword' };
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        invalidRequestAssertions(res);
        done();
      });
    });

    it('should have password', (done) => {
      request = { userName: 'testUsername' };
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        invalidRequestAssertions(res);
        done();
      });
    });
  });

  describe('For valid credentials', () => {
    runSuccessfulLoginTests(false, () => {});
    runSuccessfulLoginTests(true, rememberMeTests);
  });

  // TODO: implement this test
  describe('For invalid credentials', () => {

    // TODO: test for locking users out
  });
});

function runSuccessfulLoginTests(rememberMe, additionalTests) {
  const conditionalText = rememberMe ? '' : 'out';
  describe('With' + conditionalText + ' rememberMe flag', () => {
    beforeEach(() => {
      successfulLoginSetup(rememberMe)
    });

    afterEach(successfulLoginTeardown);

    it('Should return success status and message', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        res.should.have.status(CONSTANTS.HTTP_STATUS_CODES.OK);
        res.body.message.should.equal(CONSTANTS.RESPONSE_MESSAGES.LOGIN_SUCCESS);
        done();
      });
    });

    it('Should return correct user data in body', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        res.body.user.userName.should.equal(userName);
        res.body.user._id.should.equal(userId);
        res.body.user.groupId.should.equal(groupId);
        res.body.user.firstName.should.equal(firstName);
        res.body.user.role.should.equal(role);
        chai.expect(res.body.user.password).to.be.undefined;
        chai.expect(res.body.user.tokens).to.be.undefined;
        chai.expect(res.body.user.lockoutExpiration).to.be.undefined;
        done();
      });
    });

    // TODO: test that locked out user cannot authenticate with valid credentials

    it('Should call database to find user data', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        User.findOne.should.have.been.calledOnce;
        done();
      });
    });

    it('Should set session cookie as httponly with correct expiration and domain', (done) => {
      const sessionCookieName = config.get('session.cookieName');
      const sessionCookieDomain = config.get('cookieDomain');
      const expectedExpirationPeriod = config.get('session.expirationMinutes');
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        const resDate = Date.parse(res.headers.date);
        const sessionCookie = testUtils.cookieHelpers.getCookie(res.headers['set-cookie'], sessionCookieName);
        testUtils.cookieHelpers.getAttribute(sessionCookie, 'domain').should.equal(sessionCookieDomain);
        testUtils.cookieHelpers.isHttpOnly(sessionCookie).should.equal(true);
        const cookieDate = Date.parse(testUtils.cookieHelpers.getAttribute(sessionCookie, 'expires'));
        ((cookieDate - resDate) / 1000).should.be.closeTo(expectedExpirationPeriod * 60, 1);
        // validate that cookie value is not stored in plain text
        testUtils.cookieHelpers.valueDoesNotContainString(sessionCookie, 'userName').should.equal(true);
        done();
      });
    });

    it('Should set token in header', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        const headerToken = jwt.verify(res.body.token, process.env.TOKEN_SECRET);
        (headerToken.exp - headerToken.iat).should.equal(1200);
        headerToken.userName.should.equal(userName);
        headerToken.role.should.equal(role);
        headerToken.groupId.should.equal(groupId);
        done();
      });
    });

    additionalTests();
  });
}

function rememberMeTests() {
  let userAfterTokenUpdate;
  const rememberMeExpirationPeriod = config.get('rememberMe.expirationDays');
  let expectedExpiration;
  let clock;

  beforeEach(() => {
    const currentDate = new Date();
    clock = sinon.useFakeTimers(currentDate.getTime());
    expectedExpiration = new Date(new Date().getTime() +
        (rememberMeExpirationPeriod*24*60*60*1000));
    userAfterTokenUpdate = {
      userName: utils.data.userName,
      tokens: [ getNewToken() ]
    };
    sinon.stub(User, 'findByIdAndUpdate');
    User.findByIdAndUpdate.yields(null, userAfterTokenUpdate);
  });

  afterEach(() => {
    User.findByIdAndUpdate.restore();
    clock.restore();
  });

  describe('Should add new token in database with correct expiration', () => {
    it('If no tokens previously exist', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        User.findByIdAndUpdate.should.have.been.calledOnce;
        User.findByIdAndUpdate.should.have.been.calledWith(userId, sinon.match.object, { new: true }, sinon.match.func);
        const updatedTokens = User.findByIdAndUpdate.getCall(0).args[1].tokens;
        updatedTokens.length.should.equal(1);
        updatedTokens[updatedTokens.length - 1].expiration.getTime().should.equal(expectedExpiration.getTime());
        done();
      });
    });

    it('If token previously exists', (done) => {
      const existingTokens = [ getPastToken() ];
      testUser.tokens = existingTokens.slice();
      userAfterTokenUpdate.tokens = [ getPastToken(), getNewToken() ];
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        User.findByIdAndUpdate.should.have.been.calledOnce;
        User.findByIdAndUpdate.should.have.been.calledWith(userId, sinon.match.object, { new: true }, sinon.match.func);
        const updatedTokens = User.findByIdAndUpdate.getCall(0).args[1].tokens;
        updatedTokens.length.should.equal(existingTokens.length + 1);
        updatedTokens[updatedTokens.length - 1].expiration.getTime().should.equal(expectedExpiration.getTime());
        done();
      });
    });
  });

  it('Should set rememberMe cookie as httponly with correct expiration date and domain', (done) => {
    chai.request(server).post('/authenticate').send(request).end((err, res) => {
      const rememberMeCookieName = config.get('rememberMe.cookieName');
      const cookieDomain = config.get('cookieDomain');
      const rememberMeCookie = testUtils.cookieHelpers.getCookie(res.headers['set-cookie'], rememberMeCookieName);
      const cookieDate = Date.parse(testUtils.cookieHelpers.getAttribute(rememberMeCookie, 'expires'));
      ((cookieDate - new Date().getTime()) / 1000).should.be.closeTo(rememberMeExpirationPeriod*24*60*60, 1);
      testUtils.cookieHelpers.getAttribute(rememberMeCookie, 'domain').should.equal(cookieDomain);
      testUtils.cookieHelpers.isHttpOnly(rememberMeCookie).should.equal(true);
      // validate that cookie value is not stored in plain text
      testUtils.cookieHelpers.valueDoesNotContainString(rememberMeCookie, 'expiration').should.equal(true);
      done();
    });
  });
}

function successfulLoginSetup(rememberMe) {
  sinon.stub(User, 'findOne');

  testUser = {
    _id: userId,
    userName: userName,
    password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
    firstName: firstName,
    role: role,
    groupId: groupId,
    lockoutExpiration: new Date().getTime() - (24*60*60*1000)
  };
  User.findOne.yields(null, testUser);
  request = { userName: userName, password: password };
  if(rememberMe) {
    request.rememberMe = true;
  }
}

function successfulLoginTeardown () {
  User.findOne.restore();
}

function getNewToken() {
  return {
    _id: utils.data.tokenId,
    expiration: new Date(new Date().getTime() +
      (config.get('rememberMe.expirationDays')*24*60*60*1000))
  };
}

function getPastToken() {
  return {
    _id: '1234',
    expiration: new Date()
  };
}

function invalidRequestAssertions(res) {
  res.should.have.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_REQUEST);
  res.body.message.should.equal(CONSTANTS.RESPONSE_MESSAGES.INVALID_REQUEST);
  User.findOne.should.not.have.been.called;
}