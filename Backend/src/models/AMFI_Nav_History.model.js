import mongoose, { mongo } from "mongoose";

const AMFINavHistorySchema = new mongoose.Schema({
    nav_id:{
        type:String,
        unique: true,
        required:true
    },
    amfi_code:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"AMFIMaster",
        required:true
    },
    nav_date:{
       type:Date


    },
    nav_value:{
      
        
    }
    
     
},{timestamps: true});

export default AMFINavHistory = mongoose.model("AMFINavHistory",AMFINavHistorySchemaSchema);