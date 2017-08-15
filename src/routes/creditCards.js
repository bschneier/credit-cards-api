const router = require('express').Router;
const CreditCard = require('../models/creditCards');
const logging = require('../logging');
const CONSTANTS = require('../constants');

const apiLogger = logging.apiLogger;
const formatApiLogMessage = logging.formatApiLogMessage;

// get all credit cards in the user's group
function getCreditCardsByGroup(req, res) {
  CreditCard.find({groupId: res.locals.groupId}, (err, creditCards) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding credit cards for group '${res.locals.groupId}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`Credit card query for group ${res.locals.groupId} returned ${creditCards.length} results`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS, creditCards: creditCards });
  });
}

// get credit card info for specific card
function getCreditCardById(req, res) {
  CreditCard.findById(req.params.id, (err, creditCard) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding credit card '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (creditCard) {
      // regular users can only view cards in their group
      if(creditCard.groupId.toString() === res.locals.groupId || res.locals.role === 'admin') {
        apiLogger.info(formatApiLogMessage(`credit card ${req.params.id} found successfully`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS, creditCard: creditCard});
      }
      else {
        apiLogger.info(formatApiLogMessage(`Unauthorized request - get credit card info for ${req.params.id} made by user ${res.locals.username}`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.NOT_AUTHORIZED).send({ message: CONSTANTS.RESPONSE_MESSAGES.NOT_AUTHORIZED });
      }
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find credit card '${req.params.id}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
    }
  });
}

// update credit card info
function updateCreditCard(req, res) {
  CreditCard.findById(req.params.id, (err, creditCard) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding credit card '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (creditCard) {
      // regular users can only update cards in their group
      if(creditCard.groupId.toString() === res.locals.groupId || res.locals.role === 'admin') {
        Object.assign(creditCard, req.body);
        creditCard.save((err) => {
          if (err) {
            apiLogger.error(formatApiLogMessage(`Error updating credit card '${req.params.id}': ${err}`, req));
            return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
          }
          apiLogger.info(formatApiLogMessage(`credit card ${req.params.id} updated successfully`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
        });
      }
      else {
        apiLogger.info(formatApiLogMessage(`Unauthorized request - update credit card info for ${req.params.id} made by user ${res.locals.username}`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.NOT_AUTHORIZED).send({ message: CONSTANTS.RESPONSE_MESSAGES.NOT_AUTHORIZED });
      }
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find credit card '${req.params.id}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
    }
  });
}

// create a credit card
function createCreditCard(req, res) {
  let creditCardData = req.body;
  // regular users can only create credit cards in their own group
  if(res.locals.role !== 'admin') {
    creditCardData = Object.assign(req.body, {groupId: res.locals.groupId});
  }
  let creditCard = new CreditCard(creditCardData);
  creditCard.save((err, newCreditCard) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error creating credit card: ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }
    apiLogger.info(formatApiLogMessage(`credit card ${newCreditCard._id} created successfully`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
  });
}

// delete a credit card
function deleteCreditCard(req, res) {
  if(res.locals.role !== 'admin') {
    CreditCard.findById(req.params.id, (err, creditCard) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Error finding credit card '${req.params.id}': ${err}`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
      }

      if (creditCard) {
        // regular users can only delete cards in their group
        if(creditCard.groupId.toString() !== res.locals.groupId) {
          apiLogger.info(formatApiLogMessage(`Unauthorized request - delete credit card info for ${req.params.id} made by user ${res.locals.username}`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.NOT_AUTHORIZED).send({ message: CONSTANTS.RESPONSE_MESSAGES.NOT_AUTHORIZED });
        }
        else {
          deleteCard(req, res);
        }
      }
      else {
        apiLogger.info(formatApiLogMessage(`Could not find credit card '${req.params.id}'`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
        message: CONSTANTS.RESPONSE_MESSAGES.DATA_NOT_FOUND,
        errors: [ CONSTANTS.ERRORS.DATA_NOT_FOUND ]
      });
      }
    });
  }
  else {
    deleteCard(req, res);
  }
}

// get credit card data by query parameters for admin - returns all credit card data
function getAdminCreditCards(req, res) {
  CreditCard.find(req.query, (err, creditCards) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding credit cards for query '${req.query}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`Credit card query for ${req.query} returned ${creditCards.length} results`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS, creditCards: creditCards });
  });
}

function deleteCard(req, res) {
  CreditCard.findByIdAndRemove(req.params.id, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error deleting credit card '${req.params.id}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    apiLogger.info(formatApiLogMessage(`credit card ${req.params.id} deleted successfully`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
  });
}

let creditCardAuthenticatedRoutes = router();
creditCardAuthenticatedRoutes.get('/group', getCreditCardsByGroup);
creditCardAuthenticatedRoutes.get('/:id', getCreditCardById);
creditCardAuthenticatedRoutes.put('/:id', updateCreditCard);
creditCardAuthenticatedRoutes.post('', createCreditCard);
creditCardAuthenticatedRoutes.delete('/:id', deleteCreditCard);

let creditCardAdminRoutes = router();
creditCardAdminRoutes.get('', getAdminCreditCards);

module.exports = { creditCardAdminRoutes, creditCardAuthenticatedRoutes };