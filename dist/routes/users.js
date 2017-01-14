'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _users = require('../models/users');

var _users2 = _interopRequireDefault(_users);

var _logger = require('../logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var routes = (0, _express2.default)();
routes.get('/:id', function (req, res) {
  _users2.default.findById(req.params.id, '-password', function (err, user) {
    if (err) {
      _logger2.default.error('Error finding user \'' + req.params.id + '\': ' + err);
      res.json({ info: 'error during find user', error: err });
    }

    if (user) {
      _logger2.default.info('user ' + req.params.id + ' found successfully');
      res.json({ info: 'user found successfully', data: user });
    } else {
      _logger2.default.info('Could not find user \'' + req.params.id + '\'');
      res.json({ info: 'user not found' });
    }
  });
});

routes.put('/:id', function (req, res) {
  _users2.default.findById(req.params.id, '', function (err, user) {
    if (err) {
      _logger2.default.error('Error finding user \'' + req.params.id + '\': ' + err);
      res.json({ info: 'error during find user', error: err });
    }

    if (user) {
      Object.assign(user, req.body);
      user.save(function (err) {
        if (err) {
          _logger2.default.error('Error updating user \'' + req.params.id + '\': ' + err);
          res.json({ info: 'error during user update', error: err });
        }
        _logger2.default.info('user ' + req.params.id + ' updated successfully');
        res.json({ info: 'user updated successfully' });
      });
    } else {
      _logger2.default.info('Could not find user \'' + req.params.id + '\'');
      res.json({ info: 'user not found' });
    }
  });
});

routes.post('', function (req, res) {
  var user = new _users2.default(req.body);
  user.save(function (err) {
    if (err) {
      _logger2.default.error('Error creating user: ' + err);
      res.json({ info: 'error during user creation', error: err });
    }
    _logger2.default.info('user ' + req.params.id + ' created successfully');
    res.json({ info: 'user created successfully' });
  });
});

routes.delete('/:id', function (req, res) {
  _users2.default.findByIdAndRemove(req.params.id, function (err, user) {
    if (err) {
      _logger2.default.error('Error deleting user \'' + req.params.id + '\': ' + err);
      res.json({ info: 'error during find deletion', error: err });
    }

    _logger2.default.info('user ' + req.params.id + ' deleted successfully');
    res.json({ info: 'user deleted successfully' });
  });
});

exports.default = routes;