import assert from "node:assert/strict";
import { once } from "node:events";
import type { Express } from "express";
import express from "express";
import test from "node:test";

import { app } from "../src/app.js";
import {
  errorHandler,
  notFoundHandler,
} from "../src/middleware/error-handler.js";
import { paymentRouter } from "../src/modules/payments/payment.routes.js";

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

function createPaymentTestApp(): Express {
  const testApp = express();

  testApp.use(express.json());

  testApp.use((_req, res, next) => {
    res.locals.requestId = "payment-api-test";
    next();
  });

  testApp.use("/payments", paymentRouter);

  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  return testApp;
}

test("GET /payments rejects requests without organization context", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ORGANIZATION_CONTEXT_REQUIRED");
    assert.equal(payload.meta.requestId, "payment-api-test");
  });
});

test("GET /payments/:paymentId rejects requests without organization context", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments/payment_123`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ORGANIZATION_CONTEXT_REQUIRED");
  });
});

test("POST /payments rejects requests without organization context", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: "order_123",
        amount: "100.00",
        method: "UPI",
        provider: "razorpay",
        idempotencyKey: "payment-request-123",
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ORGANIZATION_CONTEXT_REQUIRED");
  });
});

test("POST /payments/:paymentId/refunds rejects requests without organization context", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments/payment_123/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: "25.00",
        idempotencyKey: "refund-request-123",
        reason: "Customer request",
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ORGANIZATION_CONTEXT_REQUIRED");
  });
});

test("GET /payments/:paymentId/refunds/:refundId rejects requests without organization context", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/payments/payment_123/refunds/refund_123`,
    );

    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ORGANIZATION_CONTEXT_REQUIRED");
  });
});

test("GET /payments rejects invalid query parameters", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments?page=0`);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.ok(payload.error.details.length > 0);
  });
});

test("GET /payments/:paymentId rejects payment IDs longer than 30 characters", async () => {
  const testApp = createPaymentTestApp();
  const invalidPaymentId = "a".repeat(31);

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments/${invalidPaymentId}`);

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});

test("GET /payments/:paymentId/refunds/:refundId rejects invalid refund IDs", async () => {
  const testApp = createPaymentTestApp();
  const invalidRefundId = "a".repeat(31);

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/payments/payment_123/refunds/${invalidRefundId}`,
    );

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});

test("POST /payments rejects client-supplied organization IDs", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId: "client-controlled-org",
        orderId: "order_123",
        amount: "100.00",
        method: "UPI",
        provider: "razorpay",
        idempotencyKey: "payment-request-123",
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});

test("POST /payments rejects client-supplied payment status", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: "order_123",
        amount: "100.00",
        method: "UPI",
        provider: "razorpay",
        idempotencyKey: "payment-request-123",
        status: "SUCCEEDED",
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});

test("POST /payments/:paymentId/refunds rejects client-supplied provider and status", async () => {
  const testApp = createPaymentTestApp();

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/payments/payment_123/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: "25.00",
        idempotencyKey: "refund-request-123",
        provider: "razorpay",
        status: "SUCCEEDED",
      }),
    });

    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
  });
});

test("Production app does not expose the unauthenticated Payments API", async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/payments`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ROUTE_NOT_FOUND");
  });
});

test("Production app does not expose the unauthenticated Refund API", async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/payments/payment_123/refunds`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: "25.00",
          idempotencyKey: "refund-request-123",
        }),
      },
    );

    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "ROUTE_NOT_FOUND");
  });
});
