import dotenv from 'dotenv'
import connectDB from './db/index.js'
import app from './app.js';
dotenv.config({
    path:'./.env'
})
connectDB()
.then(()=>{
    app.listen(process.env.PORT,()=>{
        console.log(`App listen from Port: ${process.env.PORT}`);
        
    })
})
.catch((err)=>{
    console.log("MongoDB connection failed: ",err);
});

/*

1st Approach:

import express from 'express'

const app = express();

// IIFE - Immediately Invoked Function Expression.
(async () => {

    try {
      await  mongoose.connect(`${process.env.MONGODB_URI}/${DB_name}`)
        app.on("error",()=>{

            console.log("ERROR: ",error);
            throw error;
        })

        app.listen(process.env.PORT,()=>{

            console.log(`App is listening on Port: ${process.env.PORT}`);
            
        })
    } catch (error) {
        console.error("Error: ",error);

        throw error;
    }
})()
*/
