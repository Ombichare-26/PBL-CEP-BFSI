import mongoose from "mongoose";
import { DB_name } from "../constants.js";

const connectDB = async function(){
    try {
       const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_name}`);
       console.log(`!!MongoDB connected !! Host: ${connectionInstance.connection.host}`);
       
    } catch (error) {
        console.log("MongoDB Connection Error: ",error);
        process.exit(1)
    }
}

export default connectDB;