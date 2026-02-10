import express from "express"
import {saveInvestmentInput} from "../controllers/investment.controller"

const router=express.Router();



router.post("/",saveInvestmentInput);

export default router;