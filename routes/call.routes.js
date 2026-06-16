const express = require('express');
const router = express.Router();
const { verifyJwtToken } = require('../middlewares/index');
const { initiateCallSchema, callStatusSchema } = require('../validator/call.validator');
const callController = require('../controllers/call.controller');
const { throwError } = require('../utils');

// Helper for Joi validation
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return throwError(400, errorMessage);
        }
        next();
    };
};

router.post(
    '/initiate',
    verifyJwtToken,
   // validate(initiateCallSchema), 
    callController.initiateCall
);

router.post(
    '/accept',
    verifyJwtToken,
  //  validate(callStatusSchema),
    callController.acceptCall
);

router.post(
    '/reject',
    verifyJwtToken,
 // validate(callStatusSchema),
    callController.rejectCall
);

router.post(
    '/end',
    verifyJwtToken,
  //  validate(callStatusSchema),
    callController.endCall
);

router.get(
    '/history',
    verifyJwtToken,
    callController.getCallHistory
);

router.get(
    '/pending-incoming',
    verifyJwtToken,
    callController.getPendingIncoming,
);

module.exports = { router, routePrefix: '/calls' };
