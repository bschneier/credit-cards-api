import { Router as router } from 'express';
import User from '../models/users';
import logger from '../logger';
import bcrypt from 'bcryptjs';

let userAuthenticatedRoutes = router();
userAuthenticatedRoutes.get('/profile', (req, res) => {
  User.find({userName: req.userName}, 'firstName lastName userName email', function (err, user) {
    if (err) {
      logger.error(`Error finding user '${req.userName}': ${err}`);
      return res.json({info: 'error during find user'});
    }

    if (user) {
      logger.info(`user ${req.userName} found successfully`);
      res.json({info: 'user found successfully', user: user});
    } else {
      logger.info(`Could not find user '${req.userName}'`);
      res.json({info: 'user not found'});
    }
  });
});

userAuthenticatedRoutes.put('/profile', (req, res) => {
  User.findOne({userName: req.userName}, '', function (err, user) {
    if (err) {
      logger.error(`Error finding user '${req.params.id}': ${err}`);
      return res.json({info: 'error during find user'});
    }

    if (user) {
      if(req.body.password) {
        if(!bcrypt.compareSync(req.body.currentPassword, user.password)) {
          logger.info(`Invalid current password provided for password update for ${req.userName}`);
          return res.json({info: 'invalid password provided'});
        }
        else {
          delete req.body.currentPassword;
        }
      }
      Object.assign(user, req.body);
      user.save((err) => {
        if (err) {
          logger.error(`Error updating user '${req.userName}': ${err}`);
          return res.json({info: 'error during user update'});
        }
        logger.info(`user ${req.userName} updated successfully`);
        res.json({info: 'user updated successfully'});
      });
    } else {
      logger.info(`Could not find user '${req.userName}'`);
      res.json({info: 'user not found'});
    }
  });
});

let userAdminRoutes = router();
userAdminRoutes.get('/:id', (req, res) => {
  User.findById(req.params.id, '-password', function (err, user) {
    if (err) {
      logger.error(`Error finding user '${req.params.id}': ${err}`);
      return res.json({info: 'error during find user'});
    }

    if (user) {
      logger.info(`user ${req.params.id} found successfully`);
      res.json({info: 'user found successfully', user: user});
    } else {
      logger.info(`Could not find user '${req.params.id}'`);
      res.json({info: 'user not found'});
    }
  });
});

userAdminRoutes.get('', (req, res) => {
  User.find(req.query, '-password', function (err, users) {
    if (err) {
      logger.error(`Error finding users for query '${req.query}': ${err}`);
      return res.json({info: 'error during find user'});
    }

    logger.info(`User query for ${req.query} returned ${users.length} results`);
    res.json({info: `found ${users.length} users`, users: users});
  });
});

userAdminRoutes.put('/:id', (req, res) => {
  User.findById(req.params.id, '', function (err, user) {
    if (err) {
      logger.error(`Error finding user '${req.params.id}': ${err}`);
      return res.json({info: 'error during find user'});
    }

    if (user) {
      Object.assign(user, req.body);
      user.save((err) => {
        if (err) {
          logger.error(`Error updating user '${req.params.id}': ${err}`);
          return res.json({info: 'error during user update'});
        }
        logger.info(`user ${req.params.id} updated successfully`);
        res.json({info: 'user updated successfully'});
      });
    } else {
      logger.info(`Could not find user '${req.params.id}'`);
      res.json({info: 'user not found'});
    }
  });
});

userAdminRoutes.post('', (req, res) => {
  let user = new User(req.body);
  user.save((err) => {
    if (err) {
      logger.error(`Error creating user: ${err}`);
      return res.json({info: 'error during user creation'});
    }
    logger.info(`user ${req.params.id} created successfully`);
    res.json({info: 'user created successfully'});
  });
});

userAdminRoutes.delete('/:id', (req, res) => {
  User.findByIdAndRemove(req.params.id, function (err, user) {
    if (err) {
      logger.error(`Error deleting user '${req.params.id}': ${err}`);
      return res.json({info: 'error during find deletion'});
    }

    logger.info(`user ${req.params.id} deleted successfully`);
    res.json({info: 'user deleted successfully'});
  });
});

export { userAdminRoutes, userAuthenticatedRoutes };