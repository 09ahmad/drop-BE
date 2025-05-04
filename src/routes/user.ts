import express, { Request, Response, Router } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import {prisma} from "../db/index"
import { validateUsername, validatePassword } from "../utils/validation";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../middleware/middleware";

const router: Router = express.Router();
router.use(express.json());
router.use(cors());

const secret = process.env.JWT_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET || "myRefreshSecret#1";
console.log("Refresh token : ",refreshSecret)
console.log("Jwt token : ",secret)


// Helper function to generate tokens
const generateTokens = (userId: string) => {
  if (!secret || !refreshSecret) {
    throw new Error("JWT secrets not configured");
  }
  const accessToken = jwt.sign({ userId }, secret, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

// USER ROUTES
router.post("/signup", async (req: Request, res: Response) => {
  const { fullName, username, password } = req.body;
  const validUsername = validateUsername.safeParse(username);
  const validPassword = validatePassword.safeParse(password);

  if (!validUsername.success || !validPassword.success) {
    res.status(403).json({
      message: "Please enter valid type of credentials",
    });
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: { username },
  });

  if (existingUser) {
    res.status(409).json({ message: "User already exists" });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name: fullName,
        refreshToken: null,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.status(201).json({
      message: "User created successfully",
      user:user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Error creating user" });
    return;
  }
});

router.post("/signin", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const validUsername = validateUsername.safeParse(username);
  const validPassword = validatePassword.safeParse(password);

  if (!validUsername.success || !validPassword.success) {
    res.status(403).json({
      message: "Please enter valid type of credentials",
    });
    return;
  }

  try {
    const user = await prisma.user.findFirst({ where: { username } });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.json({
      message: "Signed in successfully",
      user: user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Error signing in" });
    return;
  }
});

// ADMIN ROUTES (without bcrypt)
router.post("/admin-signup", async (req: Request, res: Response) => {
  const { fullName, username, password } = req.body;
  const validUsername = validateUsername.safeParse(username);
  const validPassword = validatePassword.safeParse(password);

  if (!validUsername.success || !validPassword.success) {
    res.status(403).json({
      message: "Please enter valid type of credentials",
    });
    return;
  }

  const existingAdmin = await prisma.admin.findFirst({
    where: { username },
  });

  if (existingAdmin) {
    res.status(409).json({ message: "Admin already exists" });
    return;
  }

  try {
    const admin = await prisma.admin.create({
      data: {
        username,
        password, // Storing plain text password as requested
        name: fullName,
        refreshToken: null,
      },
    });

    const { accessToken, refreshToken } = generateTokens(admin.id);

    await prisma.admin.update({
      where: { id: admin.id },
      data: { refreshToken },
    });

    res.status(201).json({
      message: "Admin created successfully",
      admin: admin,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Admin signup error:", error);
    res.status(500).json({ message: "Error creating admin" });
    return;
  }
});

router.post("/admin-login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const validUsername = validateUsername.safeParse(username);
  const validPassword = validatePassword.safeParse(password);

  if (!validUsername.success || !validPassword.success) {
    res.status(403).json({
      message: "Please enter valid type of credentials",
    });
    return;
  }

  try {
    const admin = await prisma.admin.findFirst({ where: { username } });

    if (!admin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    // Direct password comparison (no bcrypt) as requested
    if (password !== admin.password) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(admin.id);

    await prisma.admin.update({
      where: { id: admin.id },
      data: { refreshToken },
    });

    res.json({
      message: "Admin signed in successfully",
      admin:admin,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Error signing in admin" });
    return;
  }
});

// COMMON ROUTES
router.post("/refresh-token", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(401).json({ message: "Refresh token is required" });
    return;
  }

  try {
    if (!refreshSecret) {
      throw new Error("Refresh secret not configured");
    }

    const decoded = jwt.verify(refreshToken, refreshSecret) as {
      userId: string;
    };

    // Check both user and admin tables
    const user = await prisma.user.findFirst({
      where: { id: decoded.userId, refreshToken },
    });

    const admin = await prisma.admin.findFirst({
      where: { id: decoded.userId, refreshToken },
    });

    const entity = user || admin;
    if (!entity) {
      res.status(403).json({ message: "Invalid refresh token" });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      entity.id
    );

    // Update the correct table
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });
    } else if (admin) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: { refreshToken: newRefreshToken },
      });
    }

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(403).json({ message: "Invalid or expired refresh token" });
    return;
  }
});

router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    // Try to find in users table
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
      res.json({ message: "Logged out successfully" });
      return;
    }

    // Try to find in admin table
    const admin = await prisma.admin.findUnique({ where: { id: userId } });
    if (admin) {
      await prisma.admin.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
      res.json({ message: "Logged out successfully" });
      return;
    }

    res.status(404).json({ message: "User not found" });
    return;
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Error during logout" });
    return;
  }
});

export default router;
