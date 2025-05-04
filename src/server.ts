import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import mainRouter from "./routes/index";
const app = express();

const PORT = process.env.PORT || 3001;
app.use(express.json());
app.use(cors());
app.use("/api/v1", mainRouter);


app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});

