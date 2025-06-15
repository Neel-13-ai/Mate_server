const express = require("express");
const {
  register,
  loginCon,
  verifyOtp,
  resetPassword,
  changePass,
  adminDashboard,
  getUser,
  updateUser,
  allUser,
  getUserProfile,
  studentDashboard,
  userCon,
  sendOtp,
} = require("../controller/authCon");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  AddAssignment,
  getAssignment,
  UpdateAssignment,
} = require("../controller/assignmentCon");
const router = express.Router();

router.post("/register", register);
router.post("/login", loginCon);

// ------------------------------------>>> forgot password  apis
router.post("/forgot-password", sendOtp);
router.post("/otp", verifyOtp);
router.post("/reset-password", verifyToken, resetPassword);
router.patch("/change-password", verifyToken, changePass);

// ------------------------------------>>>  apis  for managing assignmate
router.post("/add-assignment", verifyToken, AddAssignment);
router.get("/get-assignment", verifyToken, getAssignment);
router.put("/update-assignment/:id", verifyToken, UpdateAssignment);

// ------------------------------------>>>  apis for the user and profile management
router.get("/user", verifyToken, userCon);

router.get("/admin-dashboard", verifyToken, adminDashboard);
router.get("/user-list", verifyToken, getUser);
router.put("/update-admin/:id", updateUser);
router.get("/alluser", verifyToken, allUser);

router.get("/profile", verifyToken, getUserProfile);
router.get("/students", verifyToken, studentDashboard);

module.exports = router;
