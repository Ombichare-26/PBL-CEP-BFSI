import express from "express"
import cors from 'cors'
import cookieParser from "cookie-parser";
const app = express();



app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))

app.use(express.json({limit:'16kb'}))
app.use(express.urlencoded({extended: true, limit:'16kb'}))
app.use(express.static('public'))
app.use(cookieParser())
export { app }


// routes import
import sessionRouter from "./routes/session.routes.js";
import investmentRouter from "./routes/investment.routes.js";
import portfolioRouter from "./routes/portfolio.routes.js";
import aiRoutes from "./routes/ai.routes.js";

// routes declaration
app.use(express.json());
app.use("/api/v1/session", sessionRouter);
app.use("/api/v1/investments", investmentRouter);
app.use("/api/v1/portfolio", portfolioRouter);
app.use("/api/v1/ai", aiRoutes);

// middleware
app.use(express.json());

// Example:
// http://localhost:8000/api/v1/session
// http://localhost:8000/api/v1/investments
// http://localhost:8000/api/v1/portfolio
app.get("/", (req, res) => {
    res.send("Backend is running");
  });

export default app
