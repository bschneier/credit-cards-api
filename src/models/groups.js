let mongoose = require('mongoose');

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = Promise;

var groupSchema = mongoose.Schema({ // eslint-disable-line new-cap
  groupName: String,
  registrationCode: String
});

module.exports = mongoose.model('Group', groupSchema, 'Groups');