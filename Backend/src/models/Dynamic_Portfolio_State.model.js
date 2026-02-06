import mongoose, { mongo } from "mongoose";

const DynamicPortfolioSchema = new mongoose.Schema({
    state_id:{
        type:String,
        unique: true,
        required:true
    },
    session_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Session",
        required:true
    },
    total_small_amount:{
       


    },
    total_flexi_amount:{
      
        
    },
    total_etf_amount:{
        
        
    },
     remaining_amount:{
        
        
    }
     
},{timestamps: true});

export default DynamicPortfolio = mongoose.model("DynamicPortfolio",DynamicPortfolioSchemaSchema);