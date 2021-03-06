let mongoose = require('mongoose');

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = Promise;

var userSchema = mongoose.Schema({ // eslint-disable-line new-cap
  username: String,
  firstName: String,
  lastName: String,
  groupId: mongoose.Schema.Types.ObjectId,
  email: String,
  role: String,
  tokens: [{
    expiration: Date
  }],
  lockoutExpiration: Date,
  password: String
});

module.exports = mongoose.model('User', userSchema, 'Users');