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
const username = utils.data.username;
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
      request = { username: 'testUsername' };
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
    beforeEach(() => {
      sinon.stub(User, 'findOne');
      User.findOne.yields(null, null);
    });

    afterEach(() => {
      User.findOne.restore();
    });

    it('Should return error response code and message', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        res.should.have.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION);
        res.body.message.should.equal(CONSTANTS.RESPONSE_MESSAGES.INVALID_CREDENTIALS);
        chai.expect(res.body.sessionUser).to.be.undefined;
        done();
      });
    });

    // TODO: test for locking users out
  });
});

function runSuccessfulLoginTests(rememberMe, additionalTests) {
  const conditionalText = rememberMe ? '' : 'out';
  describe('With' + conditionalText + ' rememberMe flag', () => {
    beforeEach(() => {
      successfulLoginSetup(rememberMe);
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
        res.body.sessionUser.username.should.equal(username);
        res.body.sessionUser._id.should.equal(userId);
        res.body.sessionUser.groupId.should.equal(groupId);
        res.body.sessionUser.firstName.should.equal(firstName);
        res.body.sessionUser.role.should.equal(role);

        // validate that unneccesary data is not returned in response
        chai.expect(res.body.sessionUser.password).to.be.undefined;
        chai.expect(res.body.sessionUser.tokens).to.be.undefined;
        chai.expect(res.body.sessionUser.lockoutExpiration).to.be.undefined;
        chai.expect(res.body.sessionUser.__v).to.be.undefined;
        done();
      });
    });

    it('Should not authenticate user who is locked out', (done) => {
      const currentDate = new Date();
      let clock = sinon.useFakeTimers(currentDate.getTime());
      testUser = {
        username: username,
        lockoutExpiration: currentDate.getTime() + 1
      };
      User.findOne.yields(null, testUser);
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        res.should.have.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION);
        res.body.message.should.equal(CONSTANTS.RESPONSE_MESSAGES.LOGIN_FAILURE);
        // TODO: assert that error array contains CONSTANTS.ERRORS.USER_LOCKED_OUT
        // res.body.errors.should.have(CONSTANTS.ERRORS.USER_LOCKED_OUT);
        chai.expect(res.body.sessionUser).to.be.undefined;
        clock.restore();
        done();
      });
    });

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
        testUtils.cookieHelpers.valueDoesNotContainString(sessionCookie, 'username').should.equal(true);
        done();
      });
    });

    it('Should set token in body', (done) => {
      chai.request(server).post('/authenticate').send(request).end((err, res) => {
        const headerToken = jwt.verify(res.body.sessionToken, process.env.TOKEN_SECRET);
        (headerToken.exp - headerToken.iat).should.equal(24*60*60);
        headerToken.username.should.equal(username);
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
    expectedExpiration = new Date(currentDate.getTime() +
        (rememberMeExpirationPeriod*24*60*60*1000));
    userAfterTokenUpdate = {
      username: utils.data.username,
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
    username: username,
    password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
    firstName: firstName,
    role: role,
    groupId: groupId,
    lockoutExpiration: new Date().getTime() - (24*60*60*1000)
  };
  User.findOne.yields(null, testUser);
  request = { username: username, password: password };
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