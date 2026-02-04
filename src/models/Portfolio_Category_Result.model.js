import mongoose, { mongo } from "mongoose";

const PortfolioCategoryResultSchema = new mongoose.Schema({
    result_id:{
        type:String,
        unique: true,
        required:true
    },
    session_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Session",
        required:true
    },
    small_pot:{
       


    },
    flexi_pot:{
      
        
    },
    etf_pot:{
        
        
    },
     classified_as:{
        
        
    }
     
},{timestamps: true});

export default PortfolioCategoryResult = mongoose.model("PortfolioCategoryResult",PortfolioCategoryResultSchemaSchema);