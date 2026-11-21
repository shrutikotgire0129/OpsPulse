import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import {
  requestIdMiddleware,
  requestLogger,
} from "./middleware/request-context.js";
import { healthRouter } from "./modules/health/health.routes.js";

const app: Express = express();

app.disable("x-powered-by");

// Request context and logging
app.use(requestIdMiddleware);
app.use(requestLogger);

// Security middleware
app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

// Request parsing
app.use(express.json({ limit: "1mb" }));

// API routes
app.use("/api/v1/health", healthRouter);

// 404 and centralized error handling must remain last
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
