const chai = require('chai');
const chaiHttp = require('chai-http');
let bcrypt = require('bcryptjs');
const sinon = require('sinon');
let User = require('../src/models/users');
const config = require('config');

chai.use(chaiHttp);

/*
  Test helper method to set up a test user, login, and create a
  session to be used for a test. The test method passes in the
  server instance, the role for the test user, a function that
  calls the http request method with the desired endpoint, and a
  callback function to be called when the api returns its response.
*/
function login(server, role, requestMethod, callback) {
  const username = 'testUser';
  const groupId = 1;
  const password = "testPassword";

  let testUser = { username: username, password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)), role: role, groupId: groupId };
  sinon.stub(User, 'findOne');
  User.findOne.yields(null, testUser);

  let request = { username: username, password: password, rememberMe: false };

  let agent = chai.request.agent(server);
  agent.post('/authenticate').send(request).end((err, res) => {
    User.findOne.restore();
    const cookies = res.headers['set-cookie'].map((value) => {
      return value.split('; ')[0];
    });
    return requestMethod(agent)
      .set(config.get('authenticationHeader'), res.body.sessionToken)
      .set('Cookie', cookies.join(';'))
      .end(callback);
  });
}

const cookieHelpers = {
  getCookie(cookies, cookieName) {
    for(let i = 0; i < cookies.length; i++) {
      let cookieValues = cookies[i].split('; ');
      let cookieNameAndValue = cookieValues[0].split('=');
      if(cookieNameAndValue[0] === cookieName) {
        return cookies[i];
      }
    }

    console.log(`Could not find cookie named ${cookieName}`);
    return null;
  },

  getAttribute(cookie, attributeName) {
    const cookieValues = cookie.split('; ');
    for(let i = 0; i < cookieValues.length; i++) {
      const attributeNameAndValue = cookieValues[i].split('=');
      if(attributeNameAndValue[0].toLowerCase() === attributeName.toLowerCase()) {
        return attributeNameAndValue[1];
      }
    }

    let cookieName = cookieValues[0].split('=')[0];
    console.log(`Could not find ${attributeName} on cookie ${cookieName}`);
    return null;
  },

  isHttpOnly(cookie) {
    const cookieValues = cookie.split('; ');
    // TODO: perform case insensitive check for 'httponly' in array values
    return true;
  },

  valueDoesNotContainString(cookie, stringValue) {
    return cookie.split('; ')[0].split('=')[1].indexOf(stringValue) === -1;
  }
};

const data = {
  username: 'testUser',
  firstName: 'test',
  lastName: 'user',
  email: 'test@user.com',
  tokenId: '123456789'
};

module.exports = { login, data, cookieHelpers };