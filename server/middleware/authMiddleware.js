const { PrismaClient } = require('../prismaClient/client');
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();

const verifyToken = async (req, res, next) => {
  console.log("verifyToken run");
  console.log(process.env.SECRET_KEY);

  const token = req.headers["authorization"];
  console.log("token", token);

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  const jwtToken = token.replace("Bearer", "").trim();
  console.log("token from auth middleware", jwtToken);

  try {
    const decoded = jwt.verify(jwtToken, process.env.SECRET_KEY);
    console.log("token verified", decoded);

    let userData;

    console.log("role", decoded.role);

    if (decoded.role === "SUPER_ADMIN") {
      userData = await prisma.sUPER_ADMIN.findUnique({
        where: { email: decoded.email },
      });
    } else if (decoded.role === "ADMIN") {
      userData = await prisma.aDMIN.findUnique({
        where: { email: decoded.email },
      });
    } else if (decoded.role === "STUDENT") {
      userData = await prisma.user.findUnique({
        where: { email: decoded.email },
      });
    }

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(userData);

    req.user = userData;
    req.role = decoded.role;
    next();
  } catch (error) {
    console.error("Token verification failed", error);
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { verifyToken };
