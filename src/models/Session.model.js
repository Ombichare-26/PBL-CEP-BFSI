import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
    session_id:{
        type:String,
        required:true,
        unique:true
    }
},{timestamps:trues});

export default Schema = mongoose.model("Schema",SessionSchema);