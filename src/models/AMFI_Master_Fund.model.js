import mongoose, { mongo } from "mongoose";

const AMFIMasterSchema = new mongoose.Schema({
    amfi_code:{
        type:String,
        unique: true,
        required:true
    },
    schema_name:{
        type:String,

        required:true
    },
    isin:{
       


    },
    fund_house:{
      
        
    },
    category:{
        
        
    },
     expense_ratio:{
        
        
    },
     risk_level:{
        
        
    },
     curr_nav:{
        
        
    },
     nav_last_updated:{
        
        
    }


},{timestamps: true});

export default AMFIMaster = mongoose.model("AMFIMaster",AMFIMasterSchemaSchema);