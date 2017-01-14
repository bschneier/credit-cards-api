import router from 'express';
import userRoutes from './users';

let routes = router();
routes.use('/users', userRoutes);

export default routes;
