import assert from "node:assert/strict";
import { once } from "node:events";
import type { Express } from "express";
import express from "express";
import test from "node:test";

import { app } from "../src/app.js";
import { errorHandler, notFoundHandler } from "../src/middleware/error-handler.js";
import { orderRouter } from "../src/modules/orders/order.routes.js";

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

function createOrderTestApp(): Express {
  const testApp = express();

  testApp.use(express.json());

  testApp.use((_req, res, next) => {
    res.locals.requestId = "order-api-test";
    next();
  });

  testApp.use("/orders", orderRouter);

  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  return testApp;
}

test("GET /orders rejects requests without organization context", async () => {
  const testApp = createOrderTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/orders`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(
      payload.error.code,
      "ORGANIZATION_CONTEXT_REQUIRED",
    );
    assert.equal(payload.meta.requestId, "order-api-test");
  });
});

test("GET /orders/:orderId rejects requests without organization context", async () => {
  const testApp = createOrderTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/orders/order_123`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(
      payload.error.code,
      "ORGANIZATION_CONTEXT_REQUIRED",
    );
  });
});

test("POST /orders rejects requests without organization context", async () => {
  const testApp = createOrderTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            productId: "product_123",
            quantity: "2",
          },
        ],
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(
      payload.error.code,
      "ORGANIZATION_CONTEXT_REQUIRED",
    );
  });
});

test("GET /orders rejects invalid query parameters", async () => {
  const testApp = createOrderTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/orders?page=0`);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.ok(payload.error.details.length > 0);
  });
});

test("GET /orders/:orderId rejects order IDs longer than 30 characters", async () => {
  const testApp = createOrderTestApp();
  const invalidOrderId = "a".repeat(31);

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/orders/${invalidOrderId}`,
    );

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});

test("POST /orders rejects client-supplied organization IDs", async () => {
  const testApp = createOrderTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId: "client-controlled-org",
        items: [
          {
            productId: "product_123",
            quantity: "1",
          },
        ],
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});

test("Production app does not expose the unauthenticated Orders API", async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/orders`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ROUTE_NOT_FOUND");
  });
});
