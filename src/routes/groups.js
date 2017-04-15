const router = require('express').Router;
const User = require('../models/users');
const Group = require('../models/groups');
const logging = require('../logging');
const CONSTANTS = require('../constants');

let apiLogger = logging.apiLogger;
let formatApiLogMessage = logging.formatApiLogMessage;

// get group info
function getGroups(req, res) {
  Group.find(req.query, (err, groups) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user groups for query '${req.query}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`User group query for ${req.query} returned ${groups.length} results`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS, groups: groups});
  });
}

// update a group
function updateGroup(req, res) {
  Group.findById(req.params.id, (err, group) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user group '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (group) {
      Object.assign(group, req.body);
      group.save((err) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error updating user group '${req.params.id}': ${err}`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
        }

        apiLogger.info(formatApiLogMessage(`user group ${req.params.id} updated successfully`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS});
      });
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find user group '${req.params.id}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
    }
  });
}

// create a group
function createGroup(req, res) {
  let group = new Group(req.body);
  group.save((err, newGroup) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error creating user group: ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`user group ${newGroup._id} created successfully`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS});
  });
}

// delete a group
function deleteGroup(req, res) {
  // delete all users in group
  User.find({groupId: req.params.id}, '_id', (err, users) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding users in group '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`User query for group ${req.params.id} returned ${users.length} results`, req));

    users.forEach((user) => {
      User.findByIdAndRemove(user._id, (err, user) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error deleting user '${user._id}': ${err}`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
        }

        apiLogger.info(formatApiLogMessage(`user ${req.params.id} deleted successfully`, req));
      });
    });
  });

  // delete group
  Group.findByIdAndRemove(req.params.id, (err, group) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error deleting user group '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`user group ${req.params.id} deleted successfully`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS});
  });
}

let groupAdminRoutes = router();
groupAdminRoutes.get('', getGroups);
groupAdminRoutes.put('/:id', updateGroup);
groupAdminRoutes.post('', createGroup);
groupAdminRoutes.delete('/:id', deleteGroup);

module.exports = groupAdminRoutes;