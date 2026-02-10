import express from "express"
import { saveUserPortfolio } from "../controllers/portfolio.controller.js"

const router = express.Router();


router.post("/", saveUserPortfolio)


export default router;