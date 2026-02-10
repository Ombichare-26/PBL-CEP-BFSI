import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/index.js";


dotenv.config({
    path:"./.env"
});

connectDB().then(() => {
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
      console.log("app is listening at port:", port);
    });
  })
  .catch((error) => {
    console.log("MONGODB CONNECTION ERROR!!:", error);
  });;
// import express from "express";

// const app = express();

// ( async () => {
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error", (error)=>{
//             console.log("Errr: ", error);
//             throw error;

//         })
//         app.listen(process.env.PORT, ()=>{
//             console.log(`Server is running on port ${process.env.PORT}`);

//         })
//     } catch (error) {
//         console.log("Error: ", error);
//             throw error;
        
//     }
// })()
