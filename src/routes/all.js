import router from 'express';
import { userAuthenticatedRoutes, userAdminRoutes } from './users';
import { authenticationGuard, adminGuard, authenticationRoutes } from './authentication';

let routes = router();
// non authenticated routes
routes.use('/users/authenticate', authenticationRoutes);

// authenticated routes
routes.use(authenticationGuard);
routes.use('/users', userAuthenticatedRoutes);

// admin routes
routes.use(adminGuard);
routes.use('/users', userAdminRoutes);

export default routes;
