const router = require('express').Router;
const bcrypt = require('bcryptjs');
const User = require('../models/users');
const Group = require('../models/groups');
const logging = require('../logging');
const CONSTANTS = require('../constants');

const apiLogger = logging.apiLogger;
const formatApiLogMessage = logging.formatApiLogMessage;

// new user registration
function createUserByRegistrationCode(req, res) {
  Group.findOne({registrationCode: req.params.registrationCode}, '_id', (err, group) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user group with code '${req.params.registrationCode}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (group) {
      let user = Object.assign(req.body, {groupId: group._id, role: 'user'});
      new User(user).save((err, newUser) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error creating user: ${err}`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
        }

        apiLogger.info(formatApiLogMessage(`user ${newUser._id} created successfully`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
      });
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find user group with code '${req.params.registrationCode}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
    }
  });
}

// get user profile data for user
function getAuthenticatedUser(req, res) {
  User.findOne({userName: res.locals.userName}, 'firstName lastName userName email', (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user '${res.locals.userName}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (user) {
      apiLogger.info(formatApiLogMessage(`user ${res.locals.userName} found successfully`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS, user: user});
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find user '${res.locals.userName}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
    }
  });
}

// update user profile data
function updateAuthenticatedUser(req, res) {
  /*
    find user by username provided in auth token, so that regular
    users can only update their own data
  */
  User.findOne({userName: res.locals.userName}, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user '${res.locals.userName}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (user) {
      if(req.body.password) {
        if(!bcrypt.compareSync(req.body.currentPassword, user.password)) {
          apiLogger.info(formatApiLogMessage(`Invalid current password provided for password update for ${res.locals.userName}`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.INVALID_PASSWORD,
        errors: [ CONSTANTS.ERRORS.INVALID_PASSWORD ]
      });
        }
        else {
          delete req.body.currentPassword;
        }
      }

      Object.assign(user, req.body);
      user.save((err) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error updating user '${req.params.id}': ${err}`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
        }

        apiLogger.info(formatApiLogMessage(`user ${req.params.id} updated successfully`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
      });
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find user '${req.params.id}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
    }
  });
}

// get user data by userid for admin - returns all user data except password
function getUserById(req, res) {
  User.findById(req.params.id, '-password', (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (user) {
      apiLogger.info(formatApiLogMessage(`user ${req.params.id} found successfully`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS, user: user});
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find user '${req.params.id}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
    }
  });
}

// get user data by query parameters for admin - returns all user data except password
function getUsers(req, res) {
  User.find(req.query, '-password', (err, users) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding users for query '${req.query}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`User query for ${req.query} returned ${users.length} results`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS, users: users});
  });
}

// update user data for admin - can update any user
function updateUser(req, res) {
  User.findById(req.params.id, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (user) {
      Object.assign(user, req.body);
      user.save((err) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error updating user '${req.params.id}': ${err}`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
        }

        apiLogger.info(formatApiLogMessage(`user ${req.params.id} updated successfully`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
      });
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find user '${req.params.id}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
    }
  });
}

// user creation by admin
function createUser(req, res) {
  let user = new User(req.body);
  user.save((err, newUser) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error creating user: ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`user ${newUser._id} created successfully`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
  });
}

// delete user
function deleteUser(req, res) {
  User.findByIdAndRemove(req.params.id, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error deleting user '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`user ${req.params.id} deleted successfully`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
  });
}

let userUnauthenticatedRoutes = router();
userUnauthenticatedRoutes.post('/:registrationCode', createUserByRegistrationCode);

let userAuthenticatedRoutes = router();
userAuthenticatedRoutes.get('/profile', getAuthenticatedUser);
userAuthenticatedRoutes.put('', updateAuthenticatedUser);

let userAdminRoutes = router();
userAdminRoutes.get('/:id', getUserById);
userAdminRoutes.get('', getUsers);
userAdminRoutes.put('/:id', updateUser);
userAdminRoutes.post('', createUser);
userAdminRoutes.delete('/:id', deleteUser);

module.exports = { userUnauthenticatedRoutes, userAdminRoutes, userAuthenticatedRoutes };