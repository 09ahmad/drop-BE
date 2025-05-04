import express,{Router} from "express";
import userRouter from "./user";
import productRouter from "./handlingProduct";
const router:Router = express.Router();
router.use("/user", userRouter);
router.use("/item", productRouter);
export default router;
