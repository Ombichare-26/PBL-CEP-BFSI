import mongoose, { mongo } from "mongoose";

const UserPortfolioSchema = new mongoose.Schema({
    portfolio_id:{
        type:String,
        unique: true,
        required:true
    },
    session_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Session",
        required:true
    },
    schema_name:{
       


    },
    isin:{
      
        
    },
    units:{
        
        
    },
     amfi_code:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"AMFIMaster",
        
    }
     
},{timestamps: true});

export default UserPortfolio = mongoose.model("UserPortfolio",UserPortfolioSchemaSchema);