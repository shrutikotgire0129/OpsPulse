
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Express } from "express";
import express from "express";
import test from "node:test";
import { z } from "zod";

import { app } from "../src/app.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../src/middleware/validate-request.js";

async function withServer(
  application: Express,
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = application.listen(0);

  await once(server, "listening");

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to determine test server address.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

function createValidationTestApp(): Express {
  const testApp = express();

  testApp.use(express.json());

  testApp.post(
    "/body",
    validateBody(
      z.object({
        name: z.string().trim().min(2),
      }),
    ),
    (req, res) => {
      res.json({
        data: req.body,
      });
    },
  );

  testApp.get(
    "/query",
    validateQuery(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
      }),
    ),
    (_req, res) => {
      res.json({
        data: res.locals.validatedRequest.query,
      });
    },
  );

  testApp.get(
    "/items/:itemId",
    validateParams(
      z.object({
        itemId: z.string().uuid(),
      }),
    ),
    (_req, res) => {
      res.json({
        data: res.locals.validatedRequest.params,
      });
    },
  );

  testApp.use(errorHandler);

  return testApp;
}

test("GET /api/v1/health returns the standard success response", async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/health`,
    );

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.status, "ok");

    const requestId = response.headers.get("x-request-id");

    assert.ok(requestId);
    assert.equal(payload.meta.requestId, requestId);
  });
});

test("Unknown API routes return a standardized 404 response", async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/unknown-route`,
    );

    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ROUTE_NOT_FOUND");
    assert.ok(payload.meta.requestId);
  });
});

test("Malformed JSON returns a standardized 400 response", async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/health`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: '{"broken":',
      },
    );

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "INVALID_JSON");
  });
});

test("Body validation accepts and transforms valid input", async () => {
  const testApp = createValidationTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/body`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "  OpsPulse  ",
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.name, "OpsPulse");
  });
});

test("Body validation rejects invalid input", async () => {
  const testApp = createValidationTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/body`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: " ",
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.ok(payload.error.details.length > 0);
  });
});

test("Query validation coerces and applies default values", async () => {
  const testApp = createValidationTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/query?page=3`,
    );

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.page, 3);
    assert.equal(typeof payload.data.page, "number");
  });
});

test("Query validation rejects invalid values", async () => {
  const testApp = createValidationTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/query?page=invalid`,
    );

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});

test("Parameter validation accepts valid UUIDs", async () => {
  const testApp = createValidationTestApp();
  const itemId = "550e8400-e29b-41d4-a716-446655440000";

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/items/${itemId}`,
    );

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.itemId, itemId);
  });
});

test("Parameter validation rejects invalid UUIDs", async () => {
  const testApp = createValidationTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/items/not-a-uuid`,
    );

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});
