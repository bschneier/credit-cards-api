import { Router as router } from 'express';
import User from '../models/users';
import Group from '../models/groups';
import { apiLogger, formatApiLogMessage } from '../logging';

let groupAdminRoutes = router();

groupAdminRoutes.get('', (req, res) => {
  Group.find(req.query, (err, groups) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user groups for query '${req.query}': ${err}`, req));
      return res.json({info: 'error during find user groups'});
    }

    apiLogger.info(formatApiLogMessage(`User group query for ${req.query} returned ${groups.length} results`, req));
    res.json({info: `found ${groups.length} user groups`, groups: groups});
  });
});

groupAdminRoutes.put('/:id', (req, res) => {
  Group.findById(req.params.id, (err, group) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user group '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during find user group'});
    }

    if (group) {
      Object.assign(group, req.body);
      group.save((err) => {
        if (err) {
          apiLogger.error(formatApiLogMessage(`Error updating user group '${req.params.id}': ${err}`, req));
          return res.json({info: 'error during user group update'});
        }
        apiLogger.info(formatApiLogMessage(`user group ${req.params.id} updated successfully`, req));
        res.json({info: 'user group updated successfully'});
      });
    } else {
      apiLogger.info(formatApiLogMessage(`Could not find user group '${req.params.id}'`, req));
      res.json({info: 'user group not found'});
    }
  });
});

groupAdminRoutes.post('', (req, res) => {
  let group = new Group(req.body);
  group.save((err, newGroup) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error creating user group: ${err}`, req));
      return res.json({info: 'error during user group creation'});
    }
    apiLogger.info(formatApiLogMessage(`user group ${newGroup._id} created successfully`, req));
    res.json({info: 'user group created successfully'});
  });
});

groupAdminRoutes.delete('/:id', (req, res) => {
  // delete all users in group
  User.find({groupId: req.params.id}, '_id', (err, users) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding users in group '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during user group deletion'});
    }

    apiLogger.info(formatApiLogMessage(`User query for group ${req.params.id} returned ${users.length} results`, req));

    users.forEach((user) => {
      User.findByIdAndRemove(user._id, (err, user) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Error deleting user '${user._id}': ${err}`, req));
        return res.json({info: 'error during user group deletion'});
      }

      apiLogger.info(formatApiLogMessage(`user ${req.params.id} deleted successfully`, req));
      });
    });
  });

  // delete group
  Group.findByIdAndRemove(req.params.id, (err, group) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error deleting user group '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during user group deletion'});
    }

    apiLogger.info(formatApiLogMessage(`user group ${req.params.id} deleted successfully`, req));
    res.json({info: 'user group deleted successfully'});
  });
});

export { groupAdminRoutes };