import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import { sendSuccess } from "../../lib/http/api-response.js";
import {
  getCurrentSession,
  logoutUser,
  loginUser,
  registerUser,
} from "./auth.service.js";
import { SESSION_COOKIE_NAME } from "./session.js";

import type { LoginInput, RegisterInput } from "./auth.schema.js";

interface AuthenticatedSessionContext {
  id: string;
  sessionId: string;
}

export const registerController: RequestHandler = async (req, res) => {
  const input = req.body as RegisterInput;

  const result = await registerUser(input);

  return sendSuccess(res, result, 201);
};

export const loginController: RequestHandler = async (req, res) => {
  const input = req.body as LoginInput;

  const result = await loginUser(input);

  res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    expires: result.expiresAt,
  });

  return sendSuccess(
    res,
    {
      user: result.user,
      organizations: result.organizations,
      expiresAt: result.expiresAt,
    },
    200,
  );
};

export const sessionController: RequestHandler = async (_req, res) => {
  const authenticatedUser = res.locals.authenticatedUser as
    | AuthenticatedSessionContext
    | undefined;

  if (!authenticatedUser) {
    return sendSuccess(res, { user: null }, 200);
  }

  const result = await getCurrentSession(
    authenticatedUser.id,
    authenticatedUser.sessionId,
  );

  return sendSuccess(res, result, 200);
};

export const logoutController: RequestHandler = async (_req, res) => {
  const authenticatedUser = res.locals.authenticatedUser as
    | AuthenticatedSessionContext
    | undefined;

  if (!authenticatedUser) {
    return sendSuccess(res, { loggedOut: true }, 200);
  }

  await logoutUser(authenticatedUser.id, authenticatedUser.sessionId);

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  return sendSuccess(res, { loggedOut: true }, 200);
};
