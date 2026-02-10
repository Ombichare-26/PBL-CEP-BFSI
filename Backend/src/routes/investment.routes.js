import express from "express"
import { saveInvestmentInput } from "../controllers/investment.controller.js"

const router=express.Router();



router.post("/",saveInvestmentInput);

export default router;