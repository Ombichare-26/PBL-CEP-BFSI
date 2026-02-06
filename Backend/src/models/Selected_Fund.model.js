import mongoose, { mongo } from "mongoose";

const SelectedFundSchema = new mongoose.Schema({
    selection_id:{
        type:String,
        unique: true,
        required:true
    },
    session_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Session",
        required:true
    },
    amfi_code:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"AMFIMaster",

        required:true

    },
    external_symbol:{
       
    },
    category:{
        
        
    },
    allocated_amount:{
        type:Number
    }

},{timestamps: true});

export default SelectedFund = mongoose.model("SelectedFund",SelectedFundSchemaSchema);