const router = require('express').Router;
const mung = require('express-mung');
const users = require('./users');
const authentication = require('./authentication');
const guards = require('./guards');
const frontEndLogRoutes = require('./frontEndLog');
const groupRoutes = require('./groups');
const creditCards = require('./creditCards');

let routes = router();
routes.use(mung.json(guards.sessionInjector));

// non authenticated routes
routes.use('/authenticate', authentication.authenticateRoute);
routes.use('/log', frontEndLogRoutes);
routes.use('/users', users.userUnauthenticatedRoutes);

// authenticated routes
routes.use(guards.authenticationGuard);
routes.use('/users', users.userAuthenticatedRoutes);
routes.use('/credit-cards', creditCards.creditCardAuthenticatedRoutes);
routes.use('/logout', authentication.logoutRoute);

// admin routes
routes.use(guards.adminGuard);
routes.use('/users', users.userAdminRoutes);
routes.use('/groups', groupRoutes);
routes.use('/credit-cards', creditCards.creditCardAdminRoutes);

module.exports = routes;