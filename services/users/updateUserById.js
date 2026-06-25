const User = require("../../models/User");
const Mate = require("../../models/Mate");
const Mentor = require("../../models/Mentor");
const { throwError } = require("../../utils");
const { uploadImage, deleteImage } = require("../uploads");
const { isAdult } = require("../../helpers/users");
const { ROLES } = require("../../constants");
// const { validateObjectId } = require("../../utils");

exports.updateUserById = async (userId, payload, image) => {
  const user = await User.findById(userId);
  if (!user || user?.isDeleted) throwError(404, "User not found");
  const isMate = user.role === ROLES.MATE;
  const isMentor = user.role === ROLES.MENTOR;

  const mateUpdate = {};
  const mentorUpdate = {};
  if (payload) {
    let {
      name,
      email,
      mobile,
      dob,
      address,
      bio,
      // categoryId,
      pricePerMin,
      pricePerHour,
      priceUnit,
      experience,
      specifications,
      languages,
      isActive,
      isAvailable,
      isOnline,
      mentorType,
    } = payload;
    if (
      typeof pricePerMin === "undefined" &&
      typeof pricePerHour !== "undefined"
    ) {
      pricePerMin = pricePerHour;
    }
    if (name) user.name = name?.toLowerCase();
    if (address) user.address = address?.toLowerCase();
    if (dob) {
      if (!isAdult(dob)) throwError(400, "User must be at least 18 years old");
      user.dob = dob;
    }
    if (email && email !== user.email) {
      email = email?.toLowerCase();
      const emailExists = await User.findOne({
        email,
        role: user.role,
        _id: { $ne: userId },
        isDeleted: false,
      });
      if (emailExists) {
        throwError(400, "Email already exists with another user");
      }
      user.email = email;
      if (!isMate && !isMentor) {
        user.isEmailVerified = false;
      }
    }
    if (mobile && mobile !== user.mobile) {
      const mobileExists = await User.findOne({
        mobile,
        role: user.role,
        _id: { $ne: userId },
        isDeleted: false,
      });
      if (mobileExists) {
        throwError(400, "Mobile number already exists with another user");
      }
      user.mobile = mobile;
      user.isMobileVerified = false;
    }
    if (isActive !== undefined) {
      user.isActive = isActive;
    }
    if (isOnline !== undefined) {
      user.isOnline = isOnline;
    }
    if (isMate) {
      // if (typeof categoryId !== "undefined") {
      //   validateObjectId(categoryId, "categoryId");
      //   mateUpdate.categoryId = categoryId;
      // }
      if (isOnline !== undefined) {
        mateUpdate.isAvailable = isOnline;
      } else if (isAvailable !== undefined) {
        mateUpdate.isAvailable = isAvailable;
      }
      if (bio !== undefined) {
        mateUpdate.bio = bio?.trim()
      }
      if (typeof pricePerMin !== "undefined") {
        if (Number(pricePerMin) <= 0)
          throwError(422, "pricePerMin must be > 0");
        mateUpdate.pricePerMin = Number(pricePerMin);
      }
      if (typeof priceUnit !== "undefined") {
        mateUpdate.priceUnit = String(priceUnit).toUpperCase();
      }
      if (typeof experience !== "undefined") {
        if (Number(experience) < 0) throwError(422, "experience must be >= 0");
        mateUpdate.experience = Number(experience);
      }
      if (typeof specifications !== "undefined") {
        const specificationsArr = Array.isArray(specifications) ? specifications : specifications.split(",");
        mateUpdate.specifications = specificationsArr
          .filter((s) => typeof s === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (typeof languages !== "undefined") {
        const languagesArr = Array.isArray(languages) ? languages : languages.split(",");
        mateUpdate.languages = languagesArr
          .filter((l) => typeof l === "string")
          .map((l) => l.trim())
          .filter(Boolean);
      }
    }
    if (isMentor) {
      if (bio !== undefined) {
        mentorUpdate.bio = bio?.trim();
      }
      if (typeof experience !== "undefined") {
        if (Number(experience) < 0) throwError(422, "experience must be >= 0");
        mentorUpdate.experience = Number(experience);
      }
      if (typeof specifications !== "undefined") {
        const specificationsArr = Array.isArray(specifications)
          ? specifications
          : specifications.split(",");
        mentorUpdate.specifications = specificationsArr
          .filter((s) => typeof s === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (typeof languages !== "undefined") {
        const languagesArr = Array.isArray(languages)
          ? languages
          : languages.split(",");
        mentorUpdate.languages = languagesArr
          .filter((l) => typeof l === "string")
          .map((l) => l.trim())
          .filter(Boolean);
      }
      if (typeof mentorType !== "undefined") {
        const normalizedMentorType = String(mentorType).toLowerCase();
        if (!["emotional", "professional"].includes(normalizedMentorType)) {
          throwError(422, "mentorType must be emotional or professional");
        }
        mentorUpdate.mentorType = normalizedMentorType;
      }
    }
  }
  if (image) {
    if (user.image) await deleteImage(user.image);
    const imageUrl = await uploadImage(image.tempFilePath);
    user.image = imageUrl;
  }
  await user.save();

  if (isMate) {
    const baseSync = {
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    };

    const hasMateChanges = Object.keys(mateUpdate).length > 0;
    if (hasMateChanges || baseSync.name || baseSync.email || baseSync.mobile) {
      const existingMate = await Mate.findOne({
        userId: user._id,
        isDeleted: false,
      });

      if (existingMate) {
        await Mate.updateOne(
          { _id: existingMate._id },
          { $set: { ...baseSync, ...mateUpdate } },
        );
      } else {
        const canCreateMate =
          // typeof mateUpdate.categoryId !== "undefined" &&
          typeof mateUpdate.pricePerMin !== "undefined" &&
          typeof mateUpdate.experience !== "undefined";

        if (canCreateMate) {
          await Mate.create({
            userId: user._id,
            ...baseSync,
            ...mateUpdate,
          });
        }
      }
    }

    // Broadcast mate status change to all clients via FCM topic
    if (mateUpdate.isAvailable !== undefined) {
      console.log(`📣 Attempting to broadcast status for ${user.name} (${user._id}) to topic 'mate_status'...`);
      const { admin, isFirebaseInitialized } = require("../../configs/firebase");
      if (isFirebaseInitialized) {
        try {
          const message = {
            topic: "mate_status",
            data: {
              event: "MATE_STATUS_CHANGED",
              mateUserId: user._id.toString(),
              mateName: user.name || "",
              isAvailable: String(mateUpdate.isAvailable),
            },
            android: { priority: "high" },
            apns: { payload: { aps: { "content-available": 1 } } } // Ensure iOS background wake
          };
          const response = await admin.messaging().send(message);
          console.log(`✅ Broadcasted mate status change: ${user.name} → ${mateUpdate.isAvailable ? "Online" : "Offline"}. Msg ID: ${response}`);
        } catch (err) {
          console.error("❌ Failed to broadcast mate status via FCM topic:", err);
        }
      } else {
        console.warn("⚠️ Firebase not initialized, skipping mate status broadcast.");
      }
    }
  }

  if (isMentor) {
    const baseSync = {
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    };

    const hasMentorChanges = Object.keys(mentorUpdate).length > 0;
    if (
      hasMentorChanges ||
      baseSync.name ||
      baseSync.email ||
      baseSync.mobile
    ) {
      const existingMentor = await Mentor.findOne({
        userId: user._id,
        isDeleted: false,
      });

      if (existingMentor) {
        await Mentor.updateOne(
          { _id: existingMentor._id },
          { $set: { ...baseSync, ...mentorUpdate } },
        );
      } else if (typeof mentorUpdate.mentorType !== "undefined") {
        await Mentor.create({
          userId: user._id,
          ...baseSync,
          ...mentorUpdate,
          experience: mentorUpdate.experience ?? 0,
        });
      }
    }
  }

  const { password, otp, ...userData } = user.toObject();
  return userData;
};
