"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const index_1 = require("../db/index");
const validation_1 = require("../utils/validation");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("../middleware/middleware");
const router = express_1.default.Router();
router.use(express_1.default.json());
router.use((0, cors_1.default)());
const secret = process.env.JWT_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET || "myRefreshSecret#1";
console.log("Refresh token : ", refreshSecret);
console.log("Jwt token : ", secret);
// Helper function to generate tokens
const generateTokens = (userId) => {
    if (!secret || !refreshSecret) {
        throw new Error("JWT secrets not configured");
    }
    const accessToken = jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: "15m" });
    const refreshToken = jsonwebtoken_1.default.sign({ userId }, refreshSecret, { expiresIn: "7d" });
    return { accessToken, refreshToken };
};
// USER ROUTES
router.post("/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { fullName, username, password } = req.body;
    const validUsername = validation_1.validateUsername.safeParse(username);
    const validPassword = validation_1.validatePassword.safeParse(password);
    if (!validUsername.success || !validPassword.success) {
        res.status(403).json({
            message: "Please enter valid type of credentials",
        });
        return;
    }
    const existingUser = yield index_1.prisma.user.findFirst({
        where: { username },
    });
    if (existingUser) {
        res.status(409).json({ message: "User already exists" });
        return;
    }
    try {
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const user = yield index_1.prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name: fullName,
                refreshToken: null,
            },
        });
        const { accessToken, refreshToken } = generateTokens(user.id);
        yield index_1.prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });
        res.status(201).json({
            message: "User created successfully",
            user: user,
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Error creating user" });
        return;
    }
}));
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    const validUsername = validation_1.validateUsername.safeParse(username);
    const validPassword = validation_1.validatePassword.safeParse(password);
    if (!validUsername.success || !validPassword.success) {
        res.status(403).json({
            message: "Please enter valid type of credentials",
        });
        return;
    }
    try {
        const user = yield index_1.prisma.user.findFirst({ where: { username } });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const passwordMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        const { accessToken, refreshToken } = generateTokens(user.id);
        yield index_1.prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });
        res.json({
            message: "Signed in successfully",
            user: user,
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        console.error("Signin error:", error);
        res.status(500).json({ message: "Error signing in" });
        return;
    }
}));
// ADMIN ROUTES (without bcrypt)
router.post("/admin-signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { fullName, username, password } = req.body;
    const validUsername = validation_1.validateUsername.safeParse(username);
    const validPassword = validation_1.validatePassword.safeParse(password);
    if (!validUsername.success || !validPassword.success) {
        res.status(403).json({
            message: "Please enter valid type of credentials",
        });
        return;
    }
    const existingAdmin = yield index_1.prisma.admin.findFirst({
        where: { username },
    });
    if (existingAdmin) {
        res.status(409).json({ message: "Admin already exists" });
        return;
    }
    try {
        const admin = yield index_1.prisma.admin.create({
            data: {
                username,
                password, // Storing plain text password as requested
                name: fullName,
                refreshToken: null,
            },
        });
        const { accessToken, refreshToken } = generateTokens(admin.id);
        yield index_1.prisma.admin.update({
            where: { id: admin.id },
            data: { refreshToken },
        });
        res.status(201).json({
            message: "Admin created successfully",
            admin: admin,
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        console.error("Admin signup error:", error);
        res.status(500).json({ message: "Error creating admin" });
        return;
    }
}));
router.post("/admin-login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    const validUsername = validation_1.validateUsername.safeParse(username);
    const validPassword = validation_1.validatePassword.safeParse(password);
    if (!validUsername.success || !validPassword.success) {
        res.status(403).json({
            message: "Please enter valid type of credentials",
        });
        return;
    }
    try {
        const admin = yield index_1.prisma.admin.findFirst({ where: { username } });
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
        yield index_1.prisma.admin.update({
            where: { id: admin.id },
            data: { refreshToken },
        });
        res.json({
            message: "Admin signed in successfully",
            admin: admin,
            accessToken,
            refreshToken,
        });
    }
    catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({ message: "Error signing in admin" });
        return;
    }
}));
// COMMON ROUTES
router.post("/refresh-token", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(401).json({ message: "Refresh token is required" });
        return;
    }
    try {
        if (!refreshSecret) {
            throw new Error("Refresh secret not configured");
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, refreshSecret);
        // Check both user and admin tables
        const user = yield index_1.prisma.user.findFirst({
            where: { id: decoded.userId, refreshToken },
        });
        const admin = yield index_1.prisma.admin.findFirst({
            where: { id: decoded.userId, refreshToken },
        });
        const entity = user || admin;
        if (!entity) {
            res.status(403).json({ message: "Invalid refresh token" });
            return;
        }
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(entity.id);
        // Update the correct table
        if (user) {
            yield index_1.prisma.user.update({
                where: { id: user.id },
                data: { refreshToken: newRefreshToken },
            });
        }
        else if (admin) {
            yield index_1.prisma.admin.update({
                where: { id: admin.id },
                data: { refreshToken: newRefreshToken },
            });
        }
        res.json({
            accessToken,
            refreshToken: newRefreshToken,
        });
    }
    catch (error) {
        console.error("Refresh token error:", error);
        res.status(403).json({ message: "Invalid or expired refresh token" });
        return;
    }
}));
router.post("/logout", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        // Try to find in users table
        const user = yield index_1.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            yield index_1.prisma.user.update({
                where: { id: userId },
                data: { refreshToken: null },
            });
            res.json({ message: "Logged out successfully" });
            return;
        }
        // Try to find in admin table
        const admin = yield index_1.prisma.admin.findUnique({ where: { id: userId } });
        if (admin) {
            yield index_1.prisma.admin.update({
                where: { id: userId },
                data: { refreshToken: null },
            });
            res.json({ message: "Logged out successfully" });
            return;
        }
        res.status(404).json({ message: "User not found" });
        return;
    }
    catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Error during logout" });
        return;
    }
}));
exports.default = router;
