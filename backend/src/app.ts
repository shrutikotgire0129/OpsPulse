import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { authenticateSession } from "./middleware/authenticate.js";
import { resolveOrganizationContext } from "./middleware/organization-context.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import {
  requestIdMiddleware,
  requestLogger,
} from "./middleware/request-context.js";

import { authRouter } from "./modules/auth/auth.routes.js";
import { categoryRouter } from "./modules/categories/category.routes.js";
import { customerRouter } from "./modules/customers/customer.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { orderRouter } from "./modules/orders/order.routes.js";
import { paymentRouter } from "./modules/payments/payment.routes.js";
import { productRouter } from "./modules/products/product.routes.js";

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

// Public API routes
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);

// Protected business API routes
// Middleware order: session authentication -> organization membership -> router permissions
const businessApiMiddleware = [authenticateSession, resolveOrganizationContext];

app.use("/api/v1/categories", ...businessApiMiddleware, categoryRouter);

app.use("/api/v1/products", ...businessApiMiddleware, productRouter);

app.use("/api/v1/customers", ...businessApiMiddleware, customerRouter);

app.use("/api/v1/orders", ...businessApiMiddleware, orderRouter);

app.use("/api/v1/payments", ...businessApiMiddleware, paymentRouter);

// 404 and centralized error handling must remain last
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
