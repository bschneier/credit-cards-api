import { Router as router } from 'express';
import CreditCard from '../models/creditCards';
import { apiLogger, formatApiLogMessage } from '../logging';

let creditCardAuthenticatedRoutes = router();

// get all credit cards in the user's group
creditCardAuthenticatedRoutes.get('/group', (req, res) => {
  CreditCard.find({groupId: req.groupId}, (err, creditCards) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding credit cards for group '${req.groupId}': ${err}`, req));
      return res.json({info: 'error during find credit cards'});
    }

    apiLogger.info(formatApiLogMessage(`Credit card query for group ${req.groupId} returned ${creditCards.length} results`, req));
    res.json({info: `found ${creditCards.length} credit cards`, creditCards: creditCards});
  });
});

// get credit card info for specific card
creditCardAuthenticatedRoutes.get('/:id', (req, res) => {
  CreditCard.findById(req.params.id, (err, creditCard) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding credit card '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during find credit card'});
    }

    if (creditCard) {
      // regular users can only view cards in their group
      if(creditCard.groupId.toString() === req.groupId || req.role === 'admin') {
        apiLogger.info(formatApiLogMessage(`credit card ${req.params.id} found successfully`, req));
        res.json({info: 'credit card found successfully', creditCard: creditCard});
      }
      else {
        apiLogger.info(formatApiLogMessage(`Unauthorized request - get credit card info for ${req.params.id} made by user ${req.userName}`, req));
        return res.status(403).send({
          success: false,
          message: 'Not authorized.'
        });
      }
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find credit card '${req.params.id}'`, req));
      res.json({info: 'credit card not found'});
    }
  });
});

// update credit card info
creditCardAuthenticatedRoutes.put('/:id', (req, res) => {
  CreditCard.findById(req.params.id, (err, creditCard) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding credit card '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during find credit card'});
    }

    if (creditCard) {
      // regular users can only update cards in their group
      if(creditCard.groupId.toString() === req.groupId || req.role === 'admin') {
        Object.assign(creditCard, req.body);
        creditCard.save((err) => {
          if (err) {
            apiLogger.error(formatApiLogMessage(`Error updating credit card '${req.params.id}': ${err}`, req));
            return res.json({info: 'error during credit card update'});
          }
          apiLogger.info(formatApiLogMessage(`credit card ${req.params.id} updated successfully`, req));
          res.json({info: 'credit card updated successfully'});
        });
      }
      else {
        apiLogger.info(formatApiLogMessage(`Unauthorized request - update credit card info for ${req.params.id} made by user ${req.userName}`, req));
        return res.status(403).send({
          success: false,
          message: 'Not authorized.'
        });
      }
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find credit card '${req.params.id}'`, req));
      res.json({info: 'credit card not found'});
    }
  });
});

// create a credit card
creditCardAuthenticatedRoutes.post('', (req, res) => {
  let creditCardData = req.body;
  // regular users can only create credit cards in their own group
  if(req.role !== 'admin') {
    creditCardData = Object.assign(req.body, {groupId: req.groupId});
  }
  let creditCard = new CreditCard(creditCardData);
  creditCard.save((err, newCreditCard) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error creating credit card: ${err}`, req));
      return res.json({info: 'error during credit card creation'});
    }
    apiLogger.info(formatApiLogMessage(`credit card ${newCreditCard._id} created successfully`, req));
    res.json({info: 'credit card created successfully'});
  });
});

// delete a credit card
creditCardAuthenticatedRoutes.delete('/:id', (req, res) => {
  if(req.role !== 'admin') {
    CreditCard.findById(req.params.id, (err, creditCard) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Error finding credit card '${req.params.id}': ${err}`, req));
        return res.json({info: 'error during find credit card'});
      }

      if (creditCard) {
        // regular users can only delete cards in their group
        if(creditCard.groupId.toString() !== req.groupId) {
          apiLogger.info(formatApiLogMessage(`Unauthorized request - delete credit card info for ${req.params.id} made by user ${req.userName}`, req));
          return res.status(403).json({
            success: false,
            message: 'Not authorized.'
          });
        }
        else {
          deleteCard(req, res);
        }
      }
      else {
        apiLogger.info(formatApiLogMessage(`Could not find credit card '${req.params.id}'`, req));
        return res.json({info: 'credit card not found'});
      }
    });
  }
  else {
    deleteCard(req, res);
  }
});

let creditCardAdminRoutes = router();

// get credit card data by query parameters for admin - returns all credit card data
creditCardAdminRoutes.get('', (req, res) => {
  CreditCard.find(req.query, (err, creditCards) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding credit cards for query '${req.query}': ${err}`, req));
      return res.json({info: 'error during find credit cards'});
    }

    apiLogger.info(formatApiLogMessage(`Credit card query for ${req.query} returned ${creditCards.length} results`, req));
    res.json({info: `found ${creditCards.length} credit cards`, creditCards: creditCards});
  });
});

function deleteCard(req, res) {
  CreditCard.findByIdAndRemove(req.params.id, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error deleting credit card '${req.params.id}': ${err}`, req));
      return res.json({info: 'error during credit card deletion'});
    }

    apiLogger.info(formatApiLogMessage(`credit card ${req.params.id} deleted successfully`, req));
    res.json({info: 'credit card deleted successfully'});
  });
}

export { creditCardAdminRoutes, creditCardAuthenticatedRoutes };