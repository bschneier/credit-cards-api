import mongoose from 'mongoose';

var userSchema = mongoose.Schema({ // eslint-disable-line new-cap
  userName: String,
  firstName: String,
  lastName: String,
  groupId: Number,
  email: String,
  role: String,
  tokens: [ String ],
  lockoutExpiration: Date,
  password: String
});

export default mongoose.model('User', userSchema);
