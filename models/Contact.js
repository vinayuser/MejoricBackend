const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
    {
        // userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true },
        mobile: { type: String, trim: true },
        subject: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Contact", contactSchema);
