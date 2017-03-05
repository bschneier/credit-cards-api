let router = require('express').Router;
let users = require('./users');
let authentication = require('./authentication');
let frontEndLogRoutes = require('./frontEndLog');
let groupRoutes = require('./groups');
let creditCards = require('./creditCards');

let routes = router();

// non authenticated routes
routes.use('/users/authenticate', authentication.routes);
routes.use('/log', frontEndLogRoutes);
routes.use('/users', users.userUnauthenticatedRoutes);

// authenticated routes
routes.use(authentication.authenticationGuard);
routes.use('/users', users.userAuthenticatedRoutes);
routes.use('/credit-cards', creditCards.creditCardAuthenticatedRoutes);

// admin routes
routes.use(authentication.adminGuard);
routes.use('/users', users.userAdminRoutes);
routes.use('/groups', groupRoutes);
routes.use('/credit-cards', creditCards.creditCardAdminRoutes);

module.exports = routes;