const errorCodes = {
  DATA_NOT_FOUND: 1,
  INVALID_PASSWORD: 2,
  USER_LOCKED_OUT: 3
};

module.exports = {
  HTTP_STATUS_CODES: {
    OK: 200,
    INVALID_REQUEST: 400,
    INVALID_AUTHENTICATION: 401,
    NOT_AUTHORIZED: 403,
    ERROR: 500
  },
  ERRORS: {
    DATA_NOT_FOUND: {
      errorCode: errorCodes.DATA_NOT_FOUND,
      message: 'data not found'
    },
    INVALID_PASSWORD: {
      errorCode: errorCodes.INVALID_PASSWORD,
      message: 'invalid password provided'
    },
    USER_LOCKED_OUT: {
      errorCode: errorCodes.USER_LOCKED_OUT,
      message: 'user account is locked out'
    }
  },
  ERROR_CODES: errorCodes,
  RESPONSE_MESSAGES: {
    DATA_NOT_FOUND: 'requested data was not found',
    INVALID_AUTHENTICATION: 'invalid authentication provided',
    INTERNAL_ERROR_MESSAGE: 'error processing the request',
    INVALID_CREDENTIALS: 'invalid login credentials',
    INVALID_PASSWORD: 'invalid password provided',
    INVALID_REQUEST: 'invalid request',
    LOGIN_SUCCESS: 'user logged in successfully',
    LOGIN_FAILURE: 'user login failed',
    LOGOUT_SUCCESS: 'user logged out successfully',
    NOT_AUTHORIZED: 'not authorized',
    SUCCESS: 'request processed successfully'
  }
};