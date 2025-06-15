const express = require("express");
const { addAdmin } = require("../controller/adminCon");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add-admin",verifyToken , addAdmin);

module.exports = router ; 