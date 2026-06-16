const express = require("express");
const router = express.Router();

const { isAdmin } = require("../middlewares");
const {
  create,
  getAll,
  getById,
  update,
  deleteContact,
} = require("../controllers/contacts");

router.post("/create", create);
router.get("/getAll", isAdmin, getAll);
router.get("/get/:id", isAdmin, getById);
router.put("/update/:id", update);
router.delete("/delete/:id", isAdmin, deleteContact);

module.exports = router;
