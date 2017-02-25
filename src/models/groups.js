import mongoose from 'mongoose';
import bluebird from 'bluebird';

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = bluebird;

var groupSchema = mongoose.Schema({ // eslint-disable-line new-cap
  groupName: String,
  registrationCode: String
});

export default mongoose.model('Group', groupSchema);