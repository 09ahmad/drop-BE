import {z} from "zod";

export const validateUsername=z.string().email().min(5,{message:"username must have atleast 5 characters"});
export const validatePassword=z.string().min(5,{message:"password must have atleast 5 characters"})