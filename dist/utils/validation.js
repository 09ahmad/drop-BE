"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePassword = exports.validateUsername = void 0;
const zod_1 = require("zod");
exports.validateUsername = zod_1.z.string().email().min(5, { message: "username must have atleast 5 characters" });
exports.validatePassword = zod_1.z.string().min(5, { message: "password must have atleast 5 characters" });
