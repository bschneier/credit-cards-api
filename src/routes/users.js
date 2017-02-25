import { Router as router } from 'express';
import User from '../models/users';
import Group from '../models/groups';
import { apiLogger, formatApiLogMessage } from '../logging';
import bcrypt from 'bcryptjs';

let userUnauthenticatedRoutes = router();
userUnauthenticatedRoutes.post('/:registrationCode', (req, res) => {
  Group.findOne({registrationCode: req.params.registrationCode}, '_id', (err, group) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user group with code '${req.params.registrationCode}': ${err}`, req));
      return res.json({info: 'error during find user group'});
    }

    if (group) {
      let user = Object.assign(req.body, {groupId: group._id, role: 'user'});
      new User(user).save((err, newUser) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error creating user: ${err}`, req));
          return res.json({info: 'error during user creation'});
        }
        apiLogger.info(formatApiLogMessage(`user ${newUser._id} created successfully`, req));
        res.json({info: 'user created successfully'});
      });
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find user group with code '${req.params.registrationCode}'`, req));
      res.json({info: 'user group not found'});
    }
  });
});

let userAuthenticatedRoutes = router();
userAuthenticatedRoutes.get('/profile', (req, res) => {
  User.find({userName: req.userName}, 'firstName lastName userName email', (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user '${req.userName}': ${err}`, req));
      return res.json({info: 'error during find user'});
    }

    if (user) {
      apiLogger.info(formatApiLogMessage(`user ${req.userName} found successfully`, req));
      res.json({info: 'user found successfully', user: user});
    } else {
      apiLogger.info(formatApiLogMessage(`Could not find user '${req.userName}'`, req));
      res.json({info: 'user not found'});
    }
  });
});

userAuthenticatedRoutes.put('/profile', (req, res) => {
  User.findOne({userName: req.userName}, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during find user'});
    }

    if (user) {
      if(req.body.password) {
        if(!bcrypt.compareSync(req.body.currentPassword, user.password)) {
          apiLogger.info(formatApiLogMessage(`Invalid current password provided for password update for ${req.userName}`, req));
          return res.json({info: 'invalid password provided'});
        }
        else {
          delete req.body.currentPassword;
        }
      }
      Object.assign(user, req.body);
      user.save((err) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error updating user '${req.userName}': ${err}`, req));
          return res.json({info: 'error during user update'});
        }
        apiLogger.info(formatApiLogMessage(`user ${req.userName} updated successfully`, req));
        res.json({info: 'user updated successfully'});
      });
    } else {
      apiLogger.info(formatApiLogMessage(`Could not find user '${req.userName}'`, req));
      res.json({info: 'user not found'});
    }
  });
});

let userAdminRoutes = router();
userAdminRoutes.get('/:id', (req, res) => {
  User.findById(req.params.id, '-password', (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during find user'});
    }

    if (user) {
      apiLogger.info(formatApiLogMessage(`user ${req.params.id} found successfully`, req));
      res.json({info: 'user found successfully', user: user});
    } else {
      apiLogger.info(formatApiLogMessage(`Could not find user '${req.params.id}'`, req));
      res.json({info: 'user not found'});
    }
  });
});

userAdminRoutes.get('', (req, res) => {
  User.find(req.query, '-password', (err, users) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding users for query '${req.query}': ${err}`, req));
      return res.json({info: 'error during find user'});
    }

    apiLogger.info(formatApiLogMessage(`User query for ${req.query} returned ${users.length} results`, req));
    res.json({info: `found ${users.length} users`, users: users});
  });
});

userAdminRoutes.put('/:id', (req, res) => {
  User.findById(req.params.id, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during find user'});
    }

    if (user) {
      Object.assign(user, req.body);
      user.save((err) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error updating user '${req.params.id}': ${err}`, req));
          return res.json({info: 'error during user update'});
        }
        apiLogger.info(formatApiLogMessage(`user ${req.params.id} updated successfully`, req));
        res.json({info: 'user updated successfully'});
      });
    } else {
      apiLogger.info(formatApiLogMessage(`Could not find user '${req.params.id}'`, req));
      res.json({info: 'user not found'});
    }
  });
});

userAdminRoutes.post('', (req, res) => {
  let user = new User(req.body);
  user.save((err, newUser) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error creating user: ${err}`, req));
      return res.json({info: 'error during user creation'});
    }
    apiLogger.info(formatApiLogMessage(`user ${newUser._id} created successfully`, req));
    res.json({info: 'user created successfully'});
  });
});

userAdminRoutes.delete('/:id', (req, res) => {
  User.findByIdAndRemove(req.params.id, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error deleting user '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during user deletion'});
    }

    apiLogger.info(formatApiLogMessage(`user ${req.params.id} deleted successfully`, req));
    res.json({info: 'user deleted successfully'});
  });
});

export { userUnauthenticatedRoutes, userAdminRoutes, userAuthenticatedRoutes };