const chai = require('chai');
const chaiHttp = require('chai-http');
let bcrypt = require('bcryptjs');
const sinon = require('sinon');
let User = require('../src/models/users');

chai.use(chaiHttp);

function login(server, role, action) {
  const userName = 'testUser';
  const groupId = 1;
  const password = "testPassword";

  let testUser = { userName: userName, password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)), role: role, groupId: groupId };
  sinon.stub(User, 'findOne');
  User.findOne.yields(null, testUser);

  let request = { userName: userName, password: password, rememberMe: false };

  let agent = chai.request.agent(server);
  agent.post('/authenticate').send(request).end((err, res) => {
    User.findOne.restore();
    return action(agent, res.body.token);
  });
}

const data = {
  userName: 'testUser',
  firstName: 'test',
  lastName: 'user',
  email: 'test@user.com',
  tokenId: '123456789'
};

module.exports = { login, data };