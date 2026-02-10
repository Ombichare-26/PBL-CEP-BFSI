import express from "express"
import {saveUserPortfoio} from "../controllers/portfolio"

const router=express.Router();


router.post.apply("/",saveUserPortfoio)


export default router;