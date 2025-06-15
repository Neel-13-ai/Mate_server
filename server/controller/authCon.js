const { PrismaClient } = require("../prismaClient/client");
const prisma = new PrismaClient();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const register = async (req, res) => {
  const { name, enrollmentNumber, email, password, branch, year, sem } =
    req.body;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }

    if (year < 1 || year > 4) {
      return res
        .status(400)
        .json({ message: "Invalid year. Must be between 1 and 4." });
    }

    const validSemesters = {
      1: [1, 2],
      2: [3, 4],
      3: [5, 6],
      4: [7, 8],
    };

    if (!validSemesters[year].includes(sem)) {
      return res.status(400).json({
        message: `Invalid semester for year ${year}. Must be one of: ${validSemesters[
          year
        ].join(", ")}`,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        enrollmentNumber,
        email,
        password: hashedPassword,
        branch,
        year: parseInt(year),
        sem: parseInt(sem),
      },
    });

    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const loginCon = async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = null;
    let role = "";

    user = await prisma.sUPER_ADMIN.findUnique({ where: { email } });
    if (user) {
      role = "SUPER_ADMIN";
    } else {
      user = await prisma.aDMIN.findUnique({ where: { email } });
      if (user) {
        role = "ADMIN";
      } else {
        user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          role = "STUDENT";
        }
      }
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: role },
      process.env.SECRET_KEY,
      { expiresIn: "1d" }
    );

    res.status(200).json({ message: `${role} logged in`, token, user });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// module.exports = { loginCon, register };

const userCon = async (req, res) => {
  console.log("contorller run user");

  try {
    return res.status(200).json(req.user);
  } catch (error) {
    console.error("error from geting user data", error);
  }
};

const getUserProfile = async (req, res) => {
  const { role, email } = req.user;

  try {
    let user = null;

    // Fetch user details based on the logged-in user's role
    if (role === "SUPER_ADMIN") {
      user = await prisma.sUPER_ADMIN.findUnique({
        where: { email },
      });
    } else if (role === "ADMIN") {
      user = await prisma.aDMIN.findUnique({
        where: { email },
      });
    } else if (role === "STUDENT") {
      user = await prisma.user.findUnique({
        where: { email },
      });
    } else {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User profile fetched successfully",
      user,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const generateOtp = () => {
  console.log("otp genreated");

  return Math.floor(1000 + Math.random() * 9000).toString();
};

const findUserByEmail = async (email) => {
  try {
    const roles = ["user", "aDMIN", "sUPER_ADMIN"];

    for (const role of roles) {
      const user = await prisma[role].findUnique({
        where: { email },
      });

      if (user) {
        return { user };
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding user:", error);
    throw new Error("Error finding user");
  }
};

const sendOtp = async (req, res) => {
  console.log("send otp executed");

  const { email } = req.body;

  console.log("user enter email get", email);

  try {
    const userData = await findUserByEmail(email);

    if (!userData) {
      return res.status(404).json({ message: "User Not Found" });
    }

    console.log("user data ", userData);

    const { user } = userData;

    const otp = generateOtp();
    console.log(otp);

    const expires_at = new Date(Date.now() + 60000);

    const otpdata = await prisma.otp.create({
      data: {
        userId: user.id,
        otpcode: otp,
        expires_at,
      },
    });

    res.status(200).json({ message: "OTP Send Successfully", expires_at });

    await sendOtpToEmail(email, otp).catch((err) => {
      console.log("error sending mail", err);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const sendOtpToEmail = async (email, otp) => {
  console.log("tranporter created");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP code",
    text: `Your OTP Code is:${otp}. It will Expires in 60 seconds.`,
  };

  await transporter.sendMail(mailOptions);
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  console.log("User inserted value:", email, otp);

  try {
    const userData = await findUserByEmail(email);

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    const { user } = userData;

    const storedOtp = await prisma.otp.findFirst({
      where: { userId: user.id },
      orderBy: { created_at: "desc" },
    });

    console.log("Database OTP:", storedOtp);

    if (!storedOtp) {
      return res.status(400).json({ message: "No OTP found" });
    }

    if (new Date() > storedOtp.expires_at) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    if (storedOtp.otpcode !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await prisma.otp.update({
      where: { id: storedOtp.id },
      data: { status: "verified" },
    });

    console.log("user", user);

    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.SECRET_KEY,
      {
        expiresIn: "15m",
      }
    );

    console.log("token", token);

    return res.json({
      message: "Otp verified successfully",
      token, // Send token bac
    });
  } catch (error) {
    console.log("Error verifying OTP:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const resetPassword = async (req, res) => {
  const { email, role } = req.user;
  const { password, confirmPassword } = req.body;

  console.log("Reset Password:", email, role, password, confirmPassword);

  try {
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let model;
    if (role === "STUDENT") model = prisma.user;
    else if (role === "ADMIN") model = prisma.aDMIN;
    else if (role === "SUPER_ADMIN") model = prisma.sUPER_ADMIN;
    else return res.status(400).json({ message: "Invalid role." });

    const updatedUser = await model.update({
      where: { email },
      data: { password: hashedPassword },
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    console.log("Password updated successfully:", updatedUser);
    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Error during password reset:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUser = async (req, res) => {
  const user = req.user;

  const role = user.role;

  try {
    if (role === "ADMIN") {
      const branch = user.branch;
      console.log("admin branch", branch);

      const students = await prisma.user.findMany({
        where: {
          branch: branch,
        },
      });

      if (!students) {
        return res.json({ message: "no student found in this branch" });
      }

      res.status(200).json({ message: "Student get successfully..", students });
    } else if (role === "SUPER_ADMIN") {
      const admins = await prisma.aDMIN.findMany();

      if (!admins) {
        return res.json({ message: "not admin founds " });
      }

      return res.json({ message: "Admin get successfully..", admins });
    } else {
      return res.json({ message: "Inavalid role" });
    }
  } catch (error) {
    console.error("error getting users", error);
  }

  console.log("user", user);
};

const changePass = async (req, res) => {
  const { currentPassword, newPassword, confirmedPassword } = req.body;
  const { email, role } = req.user;

  console.log("User details in changePass:", req.user);

  try {
    if (!currentPassword || !newPassword || !confirmedPassword) {
      return res.status(403).json({ message: "All Fileds Are Required" });
    }

    const roleModelMap = {
      STUDENT: prisma.user,
      ADMIN: prisma.aDMIN,
      SUPER_ADMIN: prisma.sUPER_ADMIN,
    };

    const model = roleModelMap[role];
    if (!model) {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    const user = await model.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!confirmedPassword == newPassword) {
      return res
        .status(401)
        .json({ message: "confirmed passowrd shoud not match" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await model.update({
      where: { email },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password changed successfully!" });
  } catch (error) {
    console.error("Error in changePass:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateUser = async (req, res) => {
  console.log("Update user controller hit");

  const { id } = req.params;
  console.log("User ID:", id);

  const { name, email, branch, enrollmentNumber, year, sem, role } = req.body;

  try {
    let user;
    let modelName;

    if (role === "ADMIN") {
      modelName = "aDMIN";
    } else if (role === "STUDENT") {
      modelName = "user"; //
    } else if (role === "SUPER_ADMIN") {
      modelName = "sUPER_ADMIN";
    } else {
      return res.status(400).json({ message: "Invalid role provided" });
    }

    // ✅ Check if the user exists
    user = await prisma[modelName].findUnique({ where: { id: id } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Ensure email uniqueness if changed
    if (email && email !== user.email) {
      const emailExists = await prisma[modelName].findUnique({
        where: { email },
      });

      if (emailExists) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    const updatedUserData = {
      name: name || user.name,
      email: email || user.email,
    };

    if (role === "ADMIN" || role === "STUDENT") {
      updatedUserData.branch = branch || user.branch;
    }

    if (role === "STUDENT") {
      updatedUserData.enrollmentNumber =
        enrollmentNumber || user.enrollmentNumber;
      updatedUserData.year = year || user.year;
      updatedUserData.sem = sem || user.sem;
    }

    // ✅ Update the user
    const updatedUser = await prisma[modelName].update({
      where: { id: id },
      data: updatedUserData,
    });

    res.status(200).json({
      message: "User updated successfully... Refresh The page!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating the user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const allUser = async (req, res) => {
  const user = req.user;
  const role = user.role;

  try {
    if (role === "SUPER_ADMIN") {
      // Fetch all admins
      const admins = await prisma.aDMIN.findMany({
        select: {
          branch: true,
        },
      });

      // Fetch all students
      const students = await prisma.user.findMany({
        where: { role: "STUDENT" },
        select: {
          branch: true,
        },
      });

      // Fetch all assignments
      const assignments = await prisma.assignment.findMany();

      // Count admins by branch
      const adminCountByBranch = {};
      admins.forEach((admin) => {
        const branch = admin.branch || "Unknown";
        adminCountByBranch[branch] = (adminCountByBranch[branch] || 0) + 1;
      });

      // Count students by branch
      const studentCountByBranch = {};
      students.forEach((student) => {
        const branch = student.branch || "Unknown";
        studentCountByBranch[branch] = (studentCountByBranch[branch] || 0) + 1;
      });

      // Send the response
      return res.status(200).json({
        success: true,
        message: "Dashboard data fetched successfully",
        data: {
          adminCountByBranch,
          studentCountByBranch,
          totalAssignments: assignments.length,
          assignments,
        },
      });
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only SUPER_ADMIN can access this data.",
      });
    }
  } catch (error) {
    console.error("Error in allUser controller:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const adminDashboard = async (req, res) => {
  const user = req.user;

  try {
    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can access this data.",
      });
    }

    const adminBranch = user.branch;
    const adminId = user.id;

    // Fetch all students in admin's branch
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        branch: adminBranch,
      },
      select: {
        year: true,
      },
    });

    // Group students by year
    const studentCountByYear = {};
    students.forEach((student) => {
      const year = student.year || "Unknown";
      studentCountByYear[year] = (studentCountByYear[year] || 0) + 1;
    });

    // Fetch total assignments uploaded by this admin
    const uploadedAssignments = await prisma.assignment.findMany({
      where: {
        adminId: adminId, // or whatever your foreign key is
      },
    });

    return res.status(200).json({
      success: true,
      message: "Admin dashboard data fetched successfully",
      data: {
        branch: adminBranch,
        studentCountByYear,
        totalUploadedAssignments: uploadedAssignments.length,
        assignments: uploadedAssignments,
      },
    });
  } catch (error) {
    console.error("Error in adminDashboard controller:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const studentDashboard = async (req, res) => {
  const user = req.user;

  try {
    if (user.role !== "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only students can access this data.",
      });
    }

    const studentBranch = user.branch;
    const studentYear = user.year;
    const studentSem = user.semester;

    const totalAssignments = await prisma.assignment.count({
      where: {
        branch: studentBranch,
        year: studentYear,
        sem: studentSem,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Student dashboard data fetched successfully",
      data: {
        totalAssignments: totalAssignments,
      },
    });
  } catch (error) {
    console.error("Error in studentDashboard controller:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  loginCon,
  userCon,
  register,
  getUserProfile,
  sendOtp,
  verifyOtp,
  resetPassword,
  getUser,
  changePass,
  updateUser,
  allUser,
  adminDashboard,
  studentDashboard,
};
