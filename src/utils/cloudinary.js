import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilepath)=>{
    try {
        if(!localFilepath){
            return null;
        }
        //Upload the file on Cloudinary
        const response = await cloudinary.uploader.upload(localFilepath,{

            resource_type:"auto",
        })

        //file uploaded on cloudinary.

        // console.log("File is Successfully Uploaded on CLoudinary. ", response.url);
        fs.unlinkSync(localFilepath)
        return response;
        
    } catch (error) {
        //remove the locally saved temporary files as the upload operation is failed.

        fs.unlinkSync(localFilepath);

        return null;
    }
}


// cloudinary. v2. uploader. upload ("https://upload.wikimedia.org/wikipedia/commons/a/ae/Olympic_flag.jpg",
// { public_id:
// "olympic_flag" },
// function (error, result) {console. log(result); });

export {uploadOnCloudinary}