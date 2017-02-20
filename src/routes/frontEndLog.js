import { Router as router } from 'express';
import { frontEndLogger, formatFrontEndLogMessage } from '../logging';

let routes = router();

routes.post('', (req, res) => {
  switch(req.body.logLevel) {
    case 'ERROR':
      frontEndLogger.error(formatFrontEndLogMessage(req));
      break;
    case 'WARN':
      frontEndLogger.warn(formatFrontEndLogMessage(req));
      break;
    default:
      frontEndLogger.info(formatFrontEndLogMessage(req));
      break;
  }
  res.json({info: 'log entry created successfully'});
});

export { routes as frontEndLogRoutes };