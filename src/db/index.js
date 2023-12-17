import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_CONNECTION_URI}/${DB_NAME}`
    );
    console.log(
      `\n Database connected on host ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("Database connection error", error);
    process.exit(1);
  }
};

export default connectDB;
