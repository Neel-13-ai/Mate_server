const { PrismaClient } = require("../prismaClient/client");

const prisma = new PrismaClient();

const AddAssignment = async (req, res) => {
  const user = req.user;

  console.log("user data:", user);
  console.log("Request body:", req.body);

  const { title, subject, description, branch, year, sem, dueDate, filePath } =
    req.body;

  if (
    !title ||
    !subject ||
    !description ||
    !branch ||
    !year ||
    !sem ||
    !dueDate ||
    !filePath
  ) {
    return res.status(400).json({
      message: "All fields including fileUrl and dueDate are required",
    });
  }

  // Validate dueDate format
  const parsedDueDate = new Date(dueDate);
  if (isNaN(parsedDueDate.getTime())) {
    return res.status(400).json({ message: "Invalid dueDate format" });
  }

  try {
    const admin = await prisma.aDMIN.findUnique({
      where: { id: user.id },
    });

    if (!admin && user.role === "ADMIN") {
      return res.status(404).json({ message: "Admin not found" });
    }

    const newAssignment = await prisma.assignment.create({
      data: {
        title,
        subject,
        description,
        branch,
        year: parseInt(year),
        sem: parseInt(sem),
        filePath: filePath, // use the Cloudinary URL
        dueDate: parsedDueDate,
        admin: user.role === "ADMIN" ? { connect: { id: user.id } } : undefined,
        superAdmin:
          user.role === "SUPER_ADMIN"
            ? { connect: { id: user.id } }
            : undefined,
      },
    });

    res
      .status(201)
      .json({ message: "Assignment added successfully", newAssignment });
  } catch (error) {
    console.error("Error adding assignment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAssignment = async (req, res) => {
  console.log("user", req.user);

  try {
    const { role, branch, semester, year, id } = req.user;

    let assignments;

    if (role === "STUDENT") {
      assignments = await prisma.assignment.findMany({
        where: {
          branch: branch,
          semester: semester,
          year: year,
        },
        include: {
          admin: true,
        },
      });
    } else if (role === "ADMIN") {
      if (!id) {
        return res.status(400).json({ message: "Admin ID is required" });
      }
      assignments = await prisma.assignment.findMany({
        where: { adminId: id },
      });
    } else if (role === "SUPER_ADMIN") {
      assignments = await prisma.assignment.findMany({
        include: {
          admin: true,
        },
      });
    } else {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    return res.status(200).json(assignments);
  } catch (error) {
    console.error("Error fetching the assignment", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const UpdateAssignment = async (req, res) => {
  const { id } = req.params;

  const user = req.user;
  const { title, subject, description, year, sem, dueDate, filePath } =
    req.body;

  console.log(
    "data for update",
    title,
    subject,
    description,
    year,
    sem,
    dueDate,
    filePath
  );

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (assignment.adminId !== user.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update this assignment" });
    }

    const updatedAssignment = await prisma.assignment.update({
      where: { id },
      data: {
        title: title,
        subject: subject,
        description: description,
        year: parseInt(year),
        sem: parseInt(sem),
        dueDate: dueDate ? new Date(dueDate) : assignment.dueDate, // <-- add this
        filePath: filePath,
      },
    });

    res.json({
      message: "Assignment updated successfully",
      updatedAssignment,
    });
  } catch (error) {
    console.error("Error updating assignment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { AddAssignment, getAssignment, UpdateAssignment };
