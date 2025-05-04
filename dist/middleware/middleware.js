"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(403).json({
            error: "Unauthorized",
        });
        return;
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return;
    }
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return;
        }
        const decode = jsonwebtoken_1.default.verify(token, secret);
        if (decode && decode.userId) {
            req.userId = decode.userId;
            next();
        }
        else {
            res.status(403).json({
                message: "Invalid token payload",
            });
            return;
        }
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                message: "Token expired. Please refresh your token.",
            });
            return;
        }
        res.status(403).json({
            message: "Error in middleware authorization",
        });
        return;
    }
};
exports.authMiddleware = authMiddleware;
