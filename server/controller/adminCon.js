const { PrismaClient } = require('../prismaClient/client');

const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const prisma = new PrismaClient();

const addAdmin = async (req, res) => {
  console.log("admin con run");

  const user = req.user;

  console.log("admin user details", user);

  const { name, email, password, branch } = req.body;

  console.log("details before insert", name, email, password, branch);

  try {
    if (user.role !== "SUPER_ADMIN") {
      return res
        .status(403)
        .json({ message: "Access denied. Only Super Admin can add admins." });
    }

    const existingAdmin = await prisma.aDMIN.findUnique({
      where: { email: email },
    });

    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await prisma.aDMIN.create({
      data: {
        name,
        email,
        password: hashedPassword,
        branch,
        superAdminId: user.id,
      },
    });

    res
      .status(201)
      .json({ message: "Admin created successfully", admin: newAdmin });

    if (newAdmin) {
      await sendPassToEmail(email, password).catch((error) => {
        console.log("error sending the mail", error);
      });
    }
  } catch (error) {
    console.error("Error adding admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const sendPassToEmail = async (email, password) => {
  console.log(`Sending email to: ${email}`);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  console.log(process.env.EMAIL_USER, process.env.EMAIL_PASS);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to the Admin Panel - Important Information",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #007bff;">Admin Account Created</h2>
        <p>Dear Admin,</p>
        <p>Your admin account has been successfully created. Below are your login details:</p>
        <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Email:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Temporary Password:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${password}</td>
          </tr>
        </table>
        <p><strong>Important:</strong> Please change your password immediately after logging in to ensure your account's security.</p>
        <p>If you have any questions, please contact the system administrator.</p>
        <p>Best regards,</p>
        <p><strong>Security Team</strong></p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = { addAdmin };
