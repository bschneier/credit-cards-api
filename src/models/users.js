import mongoose from 'mongoose';
import bluebird from 'bluebird';

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = bluebird;

var userSchema = mongoose.Schema({ // eslint-disable-line new-cap
  userName: String,
  firstName: String,
  lastName: String,
  groupId: mongoose.Schema.Types.ObjectId,
  email: String,
  role: String,
  tokens: [String],
  lockoutExpiration: Date,
  password: String
});

export default mongoose.model('User', userSchema);
