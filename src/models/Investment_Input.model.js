import mongoose, { mongo } from "mongoose";

const InvestmentInputSchema = new mongoose.Schema({
    input_id:{
        type:String,
        unique: true,
        required:true
    },
    session_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Session",
        required:true
    },
    investable_amount:{
        type:Number,
        required:true

    },
    expected_roi:{
        type:Number,
        required:true
        
    },
    duration_months:{
        type:Number,
        required:true
        
    }

},{timestamps: true});

export default InvestmentInput = mongoose.model("InvestmentInput",InvestmentInputSchema);