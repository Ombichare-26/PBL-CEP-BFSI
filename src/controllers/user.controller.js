import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiErrors} from "../utils/ApiErrors.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from "jsonwebtoken"
import mongoose from 'mongoose'

const generateAccessAndRefreshToken = async function (userId){
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // Pass RefreshToken in DB so that we don't need to login again & again after AccessTokenExpiry

        user.refreshToken = refreshToken;

       await user.save({validateBeforeSave: false})   

        return {accessToken, refreshToken}
   
    } catch (error) {
        throw new ApiErrors(500,"Something went Wrong while generating Access and Refresh Token.")
    }
}

const registerUser = asyncHandler(async (req,res)=>{

   //Step 1: get user details from frontend
   //Step 2: validation - not empty
   //Step 3: check if User already exists: Username, Email
   //Step 4: Check for Images, Check for Avatar
   //Step 5: Upload them to Cloudinary, Avatar

   //Step 6: Create User Object - create entry in DB
   //Step 7: Remove Password and Refresh Token field from response

   //Step 8: Check for User Creation
   //Step 9:return res



//Step 1:
    const {fullname, email,username,password} = req.body

    console.log("email: ",email);
    
//Step 2:
    if(
        [fullname,email,username,password].some((field)=>
            field?.trim() === "")
    ){
        throw new ApiErrors(400, "all fields are required")
    }

     //2ndMethod
    // if(fullname === ""){
    //     throw new ApiErrors(400,"fullname is required")
    // }

//Step 3:
   const UserExisted = await User.findOne(
        {
            $or: [{username},{email}]
        }
    )
    if(UserExisted){
        throw new ApiErrors(409, "User with username or email already existed")
    }

//Step 4:
    console.log(req.files);
    
    const avatarLocalPath = req.files?.avatar[0]?.path
    //const coverImageLocalPath = req.files?.coverImage[0]?.path 

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
        coverImageLocalPath = req.files.coverImage[0].path 
    }
    
    if(!avatarLocalPath){
        throw new ApiErrors(400, "Avatar Image is Required ")
    }

//Step 5:

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if(!avatar){
    throw new ApiErrors(400, "Avatar is required") 
   }

//Step 6:

   const user =  await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
   })

//Step 7 and 8:
   const createdUser = await User.findById(user._id).select("-password -refreshToken") //in select we write those thing we don't want to send.

   if(!createdUser){
    throw new ApiErrors(500, "Something went wrong while regestering")
   }

//Step 9:

   return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully !!")

   )


})


const loginUser = asyncHandler(async (req,res)=>{
    // Step 1 : req.body -> data
    // Step 2 : Username or email is required

    // Step 3 : Find the user
    // Step 4 : Password check
    // Step 5 : Access & Refresh Token
    // Step 6 : Send Cookies


//Step 1 :

    const {username, email, password} = req.body;

// Step 2 :

    if(!username && !email){
        throw new ApiErrors(400, "Username of email is required.")
    }

// Step 3 :

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiErrors(400, "User does not exist.")
    }

// Step 4 :

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiErrors(401, "Invalid User Credentials. Please Enter Correct Password.")
    }

// Step 5 :

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

// Optional as we don't want to send the password and keep it hidden.

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")


// Step 6 :

    //Cookies can only be modified from Server , not from Frontend
    const options = {
        httpOnly: true,
        secure: true
    }


    return res
    .status(200)
    
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
        {
        user:loggedInUser, accessToken, refreshToken
        },

        "User loggedIn Successfully."
        )
    )


})




const logoutUser = asyncHandler(async (req,res)=>{
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined,
            }
        },
        {
            new: true,
        }
    )

    //Cookies can only be modified from Server , not from Frontend
    const options = {
        httpOnly: true,
        secure: true
    }

    return  res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(
                new ApiResponse(200, {}, "User logged Out Successfully !!")
            )
})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    //  encoded token
   const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiErrors(401, "Unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id) 
    
        if(!user){
            throw new ApiErrors(401, "Invalid Refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiErrors(401, "Refresh Token is expired or used.")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
const { accessToken, refreshToken: newrefreshToken } =
    await generateAccessAndRefreshToken(user?._id);
    
        return  res
                .status(200)
                .cookie("accessToken",accessToken,options)
                .cookie("refreshToken",newrefreshToken,options)
                .json(
                    new ApiResponse(200, {accessToken,newrefreshToken}, "Access Token Refreshed.")
                )
    } catch (error) {
        throw new ApiErrors(401, error?.message || "Invalid refresh token.")
    }
    
})

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword, newPassword} = req.body
    if (!oldPassword || !newPassword) {
    throw new ApiErrors(400, "Old and new password are required");
}

    const user = await User.findById(req.user._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){

        throw new ApiErrors(400, "Invalid Old Password.")
    }

        user.password = newPassword;
        user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(
        new ApiResponse(200,{}, "Password Changed Successfully!!")
    )
})

const getCurrentUser = asyncHandler(async (req,res)=>{

    return res
    .status(200)
    .json(
        new ApiResponse(200,req.user, "current User fetched Successfully!!")
    )
})

const updateAccountDetails = asyncHandler(async (req,res)=>{
    const {fullname, email} = req.body;
    
    if(!fullname || !email){
        throw new ApiErrors(400, "All fields are required.")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
         {
            $set:{
                fullname: fullname,
                email:email
            }
         },

         {new: true}        // Returns the value after Updating
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Account Details Updated Successfully!! ")
    )
})

const updateUserAvatar = asyncHandler(async (req,res)=>{
    const avatarLocalPath = req.file?.path 

    if(!avatarLocalPath){
        throw new ApiErrors(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiErrors(400, "Error while Uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar:avatar.url,
            }
        },
        {new: true}).select("-password");

        return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Updated User Avatar Successfully!!")
        )
})

const updateUserCoverImage = asyncHandler(async (req,res)=>{

    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiErrors(400, "Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiErrors(40, "Error while Uploading on Cover Image.")

    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage: coverImage.url,
            }

        },
        {new:true}

    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Updated Cover Image of User Successfully!!")
    )
})

// import { User } from "../models/user.model.js";
// import { ApiErrors } from "../utils/ApiErrors.js";
// import { ApiResponse } from "../utils/ApiResponse.js";
// import { asyncHandler } from "../utils/asyncHandler.js";
// import mongoose from "mongoose";

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiErrors(400, "Username is missing");
    }

    // 1️⃣ Find the user first
    const user = await User.findOne({
        username: username.trim().toLowerCase()
    });

    if (!user) {
        throw new ApiErrors(404, "Channel does not exist");
    }

    // 2️⃣ Aggregation for subscribers/subscribedTo
    const channel = await User.aggregate([
        { $match: { _id: user._id } },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: { $size: "$subscribers" },
                channelSubscribedToCount: { $size: "$subscribedTo" },
                ifSubscribed: {
                    $cond: {
                        if: {
                            $and: [
                                { $ne: [req.user?._id, null] },
                                { $in: [req.user?._id, "$subscribers.subscriber"] }
                            ]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                ifSubscribed: 1,
                avatar: 1,
                coverImage: 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

// export { getUserChannelProfile };




const getWatchHistory = asyncHandler(async (req,res)=>{
    const user = await User.aggregate([

        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{

                from:"videos",
                localField:"watchHistory",
                foreignField:"-id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"WatchHistory Fetched Successfully!!")
    )
})
export {registerUser, loginUser, logoutUser, refreshAccessToken, 
    changeCurrentPassword, getCurrentUser, updateAccountDetails, 
    updateUserAvatar, updateUserCoverImage, getUserChannelProfile,
    getWatchHistory };