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

module.exports = { loginCon, register };
