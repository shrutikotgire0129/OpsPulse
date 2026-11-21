import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { healthRouter } from "./modules/health/health.routes.js";

const app: Express = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use("/api/v1/health", healthRouter);

export { app };
