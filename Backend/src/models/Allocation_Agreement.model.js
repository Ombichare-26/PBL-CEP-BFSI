import mongoose, { mongo } from "mongoose";

const AllocationAgreementSchema = new mongoose.Schema({
    agreement_id:{
        type:String,
        unique: true,
        required:true
    },
    session_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Session",
        required:true
    },
    target_small_pot:{
       


    },
    target_flexi_pot:{
      
        
    },
    target_etf_pot:{
        
        
    }
     
},{timestamps: true});

export default AllocationAgreement = mongoose.model("AllocationAgreement",AllocationAgreementSchemaSchema);