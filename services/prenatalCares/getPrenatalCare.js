const PrenatalCare = require("../../models/PrenatalCare");
const { throwError, validateObjectId } = require("../../utils");

exports.getPrenatalCare = async (id) => {
  validateObjectId(id, "PrenatalCare Id");
  const result = await PrenatalCare.findById(id);
  if (!result || result.isDeleted) {
    throwError(404, "Prenatal care not found");
  }
  return result;
};
