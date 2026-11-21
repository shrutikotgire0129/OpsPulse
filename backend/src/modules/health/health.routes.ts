import { Router, type Router as ExpressRouter } from "express";
import { getHealth } from "./health.controller.js";

const healthRouter: ExpressRouter = Router();

healthRouter.get("/", getHealth);

export { healthRouter };
