import mongoose from 'mongoose';

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = Promise;

var creditCardSchema = mongoose.Schema({ // eslint-disable-line new-cap
  cardName: String,
  groupId: mongoose.Schema.Types.ObjectId
});

export default mongoose.model('CreditCard', creditCardSchema, 'CreditCards');