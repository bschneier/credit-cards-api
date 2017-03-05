let mongoose = require('mongoose');

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = Promise;

var creditCardSchema = mongoose.Schema({ // eslint-disable-line new-cap
  cardName: String,
  groupId: mongoose.Schema.Types.ObjectId
});

module.exports = mongoose.model('CreditCard', creditCardSchema, 'CreditCards');