import express from "express"
import { saveInvestmentInput , getInvestmentBySession} from "../controllers/investment.controller.js"

const router=express.Router();



router.post("/",saveInvestmentInput);
router.get("/:sessionId", getInvestmentBySession);
export default router;