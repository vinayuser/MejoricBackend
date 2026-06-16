const mongoose = require("mongoose")

const callLogSchema = new mongoose.Schema({
    callSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CallSession",
    },
    event: String, // INITIATED, ACCEPTED, ENDED, etc
    meta: Object,
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model("CallLog", callLogSchema);