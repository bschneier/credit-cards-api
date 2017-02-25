import mongoose from 'mongoose';

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = Promise;

var groupSchema = mongoose.Schema({ // eslint-disable-line new-cap
  groupName: String,
  registrationCode: String
});

export default mongoose.model('Group', groupSchema);