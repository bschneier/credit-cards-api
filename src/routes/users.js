import router from 'express';
import User from '../models/users';
import logger from '../logger';

let routes = router();
routes.get('/:id', (req, res) => {
  User.findById(req.params.id, '-password', function (err, user) {
    if (err) {
      logger.error(`Error finding user '${req.params.id}': ${err}`);
      res.json({info: 'error during find user', error: err});
    }

    if (user) {
      logger.info(`user ${req.params.id} found successfully`);
      res.json({info: 'user found successfully', data: user});
    } else {
      logger.info(`Could not find user '${req.params.id}'`);
      res.json({info: 'user not found'});
    }
  });
});

routes.put('/:id', (req, res) => {
  User.findById(req.params.id, '', function (err, user) {
    if (err) {
      logger.error(`Error finding user '${req.params.id}': ${err}`);
      res.json({info: 'error during find user', error: err});
    }

    if (user) {
      Object.assign(user, req.body);
      user.save((err) => {
        if (err) {
          logger.error(`Error updating user '${req.params.id}': ${err}`);
          res.json({info: 'error during user update', error: err});
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

routes.post('', (req, res) => {
  let user = new User(req.body);
  user.save((err) => {
    if (err) {
      logger.error(`Error creating user: ${err}`);
      res.json({info: 'error during user creation', error: err});
    }
    logger.info(`user ${req.params.id} created successfully`);
    res.json({info: 'user created successfully'});
  });
});

routes.delete('/:id', (req, res) => {
  User.findByIdAndRemove(req.params.id, function (err, user) {
    if (err) {
      logger.error(`Error deleting user '${req.params.id}': ${err}`);
      res.json({info: 'error during find deletion', error: err});
    }

    logger.info(`user ${req.params.id} deleted successfully`);
    res.json({info: 'user deleted successfully'});
  });
});

export default routes;