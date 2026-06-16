const Joi = require('joi');
const { validObjectId } = require('./common');

const initiateCallSchema = Joi.object({
    // receiverId: validObjectId.messages({
    //     "any.required": "receiverId is required",
    //     "string.pattern.name": "receiverId must be a valid ObjectId",
    // }), // required()
    callType: Joi.string().valid('AUDIO', 'VIDEO').required().messages({
        "any.required": "callType is required",
        "any.only": "callType must be either AUDIO or VIDEO",
    }),
});

const callStatusSchema = Joi.object({
    // callSessionId: validObjectId.required().messages({
    //     "any.required": "callSessionId is required",
    //     "string.pattern.name": "callSessionId must be a valid ObjectId",
    // }),
});

module.exports = {
    initiateCallSchema,
    callStatusSchema,
};
