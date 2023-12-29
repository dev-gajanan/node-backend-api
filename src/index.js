import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
  path: "./.env",
});

connectDB()
  .then(() => {
    const serverPort = process.env.PORT || 8000;
    app.listen(serverPort, () => {
      console.log(`Application running on port: ${serverPort}`);
    });
  })
  .catch((err) => {
    console.log("Database connection failed!!", err);
  });
