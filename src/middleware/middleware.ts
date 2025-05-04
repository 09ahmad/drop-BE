import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
const app = express();
app.use(express.json());
import dotenv from "dotenv";
dotenv.config();

declare module "express" {
  interface Request {
    userId?: string;
  }
}
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
    const decode = jwt.verify(token, secret) as { userId: string };
    if (decode && decode.userId) {
      req.userId = decode.userId;
      next();
    } else {
      res.status(403).json({
        message: "Invalid token payload",
      });
      return;
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
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
