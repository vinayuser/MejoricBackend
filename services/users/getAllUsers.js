// const mongoose = require("mongoose");
const User = require("../../models/User");
const { pagination, throwError } = require("../../utils");
const { ROLES } = require("../../constants");

exports.getAllUsers = async (query) => {
  let {
    page,
    limit,
    role,
    language,
    languages,
    search,
    name,
    email,
    mobile,
    isActive,
    // categoryId,
    specification,
    specifications,
    pricePerHour,
    minPricePerHour,
    maxPricePerHour,
    pricePerMin,
    minPricePerMin,
    maxPricePerMin,
    priceUnit,
    experience,
    minExperience,
    maxExperience,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  page = page ? Number(page) : 1;
  limit = limit ? Number(limit) : 10;

  const userMatch = { isDeleted: false, role: { $ne: ROLES.ADMIN } };
  if (typeof isActive !== "undefined") {
    userMatch.isActive = isActive === "true" || isActive === true;
  }

  if (role) {
    role = String(role).toLowerCase();
    userMatch.role = role;
  }

  if (name) userMatch.name = { $regex: new RegExp(name, "i") };
  if (email) userMatch.email = { $regex: new RegExp(email, "i") };
  if (mobile) userMatch.mobile = Number(mobile);

  if (search) {
    userMatch.$or = [
      { name: { $regex: new RegExp(search, "i") } },
      { email: { $regex: new RegExp(search, "i") } },
    ];
    if (!Number.isNaN(Number(search))) {
      userMatch.$or.push({ mobile: Number(search) });
    }
  }

  const pipeline = [{ $match: userMatch }];

  const needMateJoin =
    userMatch.role !== ROLES.MENTOR &&
    (sortBy === "isAvailable" ||
      (userMatch.role && userMatch.role === ROLES.MATE) ||
      (typeof role === "undefined" && typeof query.mentorType === "undefined") ||
      typeof language !== "undefined" ||
      typeof languages !== "undefined" ||
      typeof pricePerHour !== "undefined" ||
      typeof minPricePerHour !== "undefined" ||
      typeof maxPricePerHour !== "undefined" ||
      typeof pricePerMin !== "undefined" ||
      typeof minPricePerMin !== "undefined" ||
      typeof maxPricePerMin !== "undefined" ||
      typeof priceUnit !== "undefined" ||
      typeof experience !== "undefined" ||
      typeof minExperience !== "undefined" ||
      typeof maxExperience !== "undefined" ||
      typeof specification !== "undefined" ||
      typeof specifications !== "undefined");

  const needMentorJoin =
    (userMatch.role && userMatch.role === ROLES.MENTOR) ||
    typeof query.mentorType !== "undefined";

  if (needMateJoin) {
    pipeline.push({
      $lookup: {
        from: "mates",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$userId", "$$userId"] },
              isDeleted: false,
            },
          },
        ],
        as: "mate",
      },
    });

    const mustHaveMateDoc = userMatch.role === ROLES.MATE;
    pipeline.push({
      $unwind: {
        path: "$mate",
        preserveNullAndEmptyArrays: !mustHaveMateDoc,
      },
    });

    const mateMatch = {};

    const langs = languages || language;
    if (langs) {
      const arr = Array.isArray(langs)
        ? langs
        : String(langs)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      if (arr.length) mateMatch["mate.languages"] = { $in: arr };
    }

    if (priceUnit)
      mateMatch["mate.priceUnit"] = String(priceUnit).toUpperCase();

    // if (categoryId) {
    //   mateMatch["mate.categoryId"] = new mongoose.Types.ObjectId(categoryId);
    // }

    const effectivePricePerMin =
      typeof pricePerMin !== "undefined" ? pricePerMin : pricePerHour;
    const effectiveMinPricePerMin =
      typeof minPricePerMin !== "undefined" ? minPricePerMin : minPricePerHour;
    const effectiveMaxPricePerMin =
      typeof maxPricePerMin !== "undefined" ? maxPricePerMin : maxPricePerHour;

    if (typeof effectivePricePerMin !== "undefined") {
      mateMatch["mate.pricePerMin"] = Number(effectivePricePerMin);
    } else if (effectiveMinPricePerMin || effectiveMaxPricePerMin) {
      mateMatch["mate.pricePerMin"] = {};
      if (effectiveMinPricePerMin)
        mateMatch["mate.pricePerMin"].$gte = Number(effectiveMinPricePerMin);
      if (effectiveMaxPricePerMin)
        mateMatch["mate.pricePerMin"].$lte = Number(effectiveMaxPricePerMin);
    }

    if (typeof experience !== "undefined") {
      mateMatch["mate.experience"] = Number(experience);
    } else if (minExperience || maxExperience) {
      mateMatch["mate.experience"] = {};
      if (minExperience)
        mateMatch["mate.experience"].$gte = Number(minExperience);
      if (maxExperience)
        mateMatch["mate.experience"].$lte = Number(maxExperience);
    }

    const specs = specifications || specification;
    if (specs) {
      const arr = Array.isArray(specs)
        ? specs
        : String(specs)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      if (arr.length) mateMatch["mate.specifications"] = { $in: arr };
    }

    if (Object.keys(mateMatch).length) pipeline.push({ $match: mateMatch });

    pipeline.push({
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true,
      },
    });
  }

  if (needMentorJoin) {
    pipeline.push({
      $lookup: {
        from: "mentors",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$userId", "$$userId"] },
              isDeleted: false,
            },
          },
        ],
        as: "mentor",
      },
    });

    const mustHaveMentorDoc = userMatch.role === ROLES.MENTOR;
    pipeline.push({
      $unwind: {
        path: "$mentor",
        preserveNullAndEmptyArrays: !mustHaveMentorDoc,
      },
    });

    const mentorMatch = {};

    const mentorLangs = languages || language;
    if (mentorLangs) {
      const arr = Array.isArray(mentorLangs)
        ? mentorLangs
        : String(mentorLangs)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      if (arr.length) mentorMatch["mentor.languages"] = { $in: arr };
    }

    if (typeof experience !== "undefined") {
      mentorMatch["mentor.experience"] = Number(experience);
    } else if (minExperience || maxExperience) {
      mentorMatch["mentor.experience"] = {};
      if (minExperience)
        mentorMatch["mentor.experience"].$gte = Number(minExperience);
      if (maxExperience)
        mentorMatch["mentor.experience"].$lte = Number(maxExperience);
    }

    const mentorSpecs = specifications || specification;
    if (mentorSpecs) {
      const arr = Array.isArray(mentorSpecs)
        ? mentorSpecs
        : String(mentorSpecs)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      if (arr.length) mentorMatch["mentor.specifications"] = { $in: arr };
    }

    if (query.mentorType) {
      mentorMatch["mentor.mentorType"] = String(query.mentorType).toLowerCase();
    }

    if (Object.keys(mentorMatch).length) pipeline.push({ $match: mentorMatch });
  }

  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      email: 1,
      mobile: 1,
      image: 1,
      address: 1,
      isOnline: 1,
      isActive: 1,
      isOnBoardingCompleted: 1,
      role: 1,
      createdAt: 1,
      updatedAt: 1,
      "mate.name": 1,
      "mate.isAvailable": 1,
      "mate.isBusy": 1,
      "mate.specifications": 1,
      "mate.pricePerMin": 1,
      "mate.languages": 1,
      "mate.experience": 1,
      "mate.bio": 1,
      "mate.priceUnit": 1,
      "mentor.name": 1,
      "mentor.specifications": 1,
      "mentor.languages": 1,
      "mentor.experience": 1,
      "mentor.bio": 1,
      "mentor.mentorType": 1,
    },
  });

  const sortStage = {};
  if (sortBy === "isAvailable") {
    sortStage["mate.isAvailable"] = -1;
    sortStage["createdAt"] = sortOrder === "asc" ? 1 : -1;
  } else {
    sortStage[sortBy] = sortOrder === "asc" ? 1 : -1;
  }
  pipeline.push({ $sort: sortStage });

  try {
    return await pagination(User, pipeline, page, limit);
  } catch (err) {
    if (err && err.statusCode === 404) throwError(404, "No any user found");
    throw err;
  }
};
