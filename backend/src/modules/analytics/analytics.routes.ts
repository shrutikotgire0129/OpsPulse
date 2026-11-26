import { Router, type Router as ExpressRouter } from "express";

import { authorize } from "../../middleware/authorization.js";
import { validateQuery } from "../../middleware/validate-request.js";

import { dashboardQuerySchema } from "./analytics.schema.js";

import { getDashboardAnalyticsController } from "./analytics.controller.js";

const analyticsRouter: ExpressRouter = Router();

analyticsRouter.get(
  "/dashboard",
  authorize("analytics:read"),
  validateQuery(dashboardQuerySchema),
  getDashboardAnalyticsController,
);

export { analyticsRouter };
