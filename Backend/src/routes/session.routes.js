import express from "express";
import { createSession } from "../controllers/session.controller.js";

const router = express.Router();

/*
  POST /api/session
*/
router.post("/", createSession);

export default router;
