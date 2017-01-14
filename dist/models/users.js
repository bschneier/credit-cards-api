'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var userSchema = _mongoose2.default.Schema({ // eslint-disable-line new-cap
  userName: String,
  firstName: String,
  lastName: String,
  groupId: Number,
  email: String,
  role: String,
  tokens: [String],
  lockoutExpiration: Date,
  password: String
});

exports.default = _mongoose2.default.model('User', userSchema);