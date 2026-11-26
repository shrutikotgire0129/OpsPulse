import { Router, type Router as ExpressRouter } from "express";
import {
  loginController,
  logoutController,
  registerController,
  sessionController,
} from "./auth.controller.js";
import { authenticateSession } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate-request.js";

import { loginSchema, registerSchema } from "./auth.schema.js";

const authRouter: ExpressRouter = Router();

authRouter.post("/register", validateBody(registerSchema), registerController);

authRouter.post("/login", validateBody(loginSchema), loginController);

authRouter.post("/logout", authenticateSession, logoutController);

authRouter.get("/session", authenticateSession, sessionController);

export { authRouter };
