const express = require("express");
const { register, loginCon } = require("../controller/authCon");
const router = express.Router();

router.post("/register", register);
router.post("/login", loginCon);


module.exports = router;