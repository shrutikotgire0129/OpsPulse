import { Router, type Router as ExpressRouter } from "express";
import { getHealth, getReadiness } from "./health.controller.js";

const healthRouter: ExpressRouter = Router();

healthRouter.get("/", getHealth);
healthRouter.get("/ready", getReadiness);

export { healthRouter };
