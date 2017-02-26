import { Router as router } from 'express';
import { userUnauthenticatedRoutes, userAuthenticatedRoutes, userAdminRoutes } from './users';
import { authenticationGuard, adminGuard, authenticationRoutes } from './authentication';
import { frontEndLogRoutes } from './frontEndLog';
import { groupAdminRoutes } from './groups';
import { creditCardAuthenticatedRoutes, creditCardAdminRoutes } from './creditCards';

let routes = router();

// non authenticated routes
routes.use('/users/authenticate', authenticationRoutes);
routes.use('/log', frontEndLogRoutes);
routes.use('/users', userUnauthenticatedRoutes);

// authenticated routes
routes.use(authenticationGuard);
routes.use('/users', userAuthenticatedRoutes);
routes.use('/credit-cards', creditCardAuthenticatedRoutes);

// admin routes
routes.use(adminGuard);
routes.use('/users', userAdminRoutes);
routes.use('/groups', groupAdminRoutes);
routes.use('/credit-cards', creditCardAdminRoutes);

export default routes;