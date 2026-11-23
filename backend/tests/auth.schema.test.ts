import assert from "node:assert/strict";
import test from "node:test";

import { registerSchema } from "../src/modules/auth/auth.schema.js";

const validInput = {
  name: "Shruti",
  email: "SHRUTI@EXAMPLE.COM",
  password: "OpsPulse-Secure-Password-2026!",
  organizationName: "Acme Technologies",
};

test("Valid registration input is accepted", () => {
  const result = registerSchema.safeParse(validInput);

  assert.equal(result.success, true);
});

test("Email is trimmed and normalized to lowercase", () => {
  const result = registerSchema.safeParse({
    ...validInput,
    email: "  SHRUTI@EXAMPLE.COM  ",
  });

  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(result.data.email, "shruti@example.com");
  }
});

test("Invalid email addresses are rejected", () => {
  const result = registerSchema.safeParse({
    ...validInput,
    email: "invalid-email",
  });

  assert.equal(result.success, false);
});

test("Passwords shorter than 12 characters are rejected", () => {
  const result = registerSchema.safeParse({
    ...validInput,
    password: "Short123!",
  });

  assert.equal(result.success, false);
});

test("Passwords longer than 128 characters are rejected", () => {
  const result = registerSchema.safeParse({
    ...validInput,
    password: "A".repeat(129),
  });

  assert.equal(result.success, false);
});

test("Names shorter than 2 characters are rejected", () => {
  const result = registerSchema.safeParse({
    ...validInput,
    name: "A",
  });

  assert.equal(result.success, false);
});

test("Organization names shorter than 2 characters are rejected", () => {
  const result = registerSchema.safeParse({
    ...validInput,
    organizationName: "A",
  });

  assert.equal(result.success, false);
});

test("Unexpected registration fields are rejected", () => {
  const result = registerSchema.safeParse({
    ...validInput,
    role: "OWNER",
  });

  assert.equal(result.success, false);
});
