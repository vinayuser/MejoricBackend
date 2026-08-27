const mongoose = require("mongoose");

const corporateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    /** Stored without @, e.g. outlinesystem.com */
    emailDomain: { type: String, required: true, lowercase: true, trim: true },
    audioMinutesTotal: { type: Number, default: 0, min: 0 },
    videoMinutesTotal: { type: Number, default: 0, min: 0 },
    chatMinutesTotal: { type: Number, default: 0, min: 0 },
    audioMinutesUsed: { type: Number, default: 0, min: 0 },
    videoMinutesUsed: { type: Number, default: 0, min: 0 },
    chatMinutesUsed: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, select: false },

    /** Contract & commercial terms (B2B — company pays Mejoric) */
    billingContactName: { type: String, trim: true },
    billingContactEmail: { type: String, trim: true, lowercase: true },
    billingContactPhone: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    billingAddress: { type: String, trim: true },
    /** Recurring platform fee charged to the company (INR) */
    monthlyPlatformFee: { type: Number, default: 0, min: 0 },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "half_yearly", "yearly"],
      default: "monthly",
    },
    contractStartDate: { type: Date },
    contractEndDate: { type: Date },
    /** Days after invoice date before payment is due */
    paymentTermsDays: { type: Number, default: 15, min: 0 },
    /** One-time setup / onboarding fee (optional) */
    setupFee: { type: Number, default: 0, min: 0 },
    /** Internal notes for admin */
    adminNotes: { type: String, trim: true },
    /** Auto-generate invoice when a billing period starts */
    autoRenewInvoice: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

corporateSchema.index({ emailDomain: 1, isActive: 1 });

module.exports = mongoose.model("Corporate", corporateSchema);
