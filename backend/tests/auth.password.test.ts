
import assert from "node:assert/strict";
import test from "node:test";

import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "../src/modules/auth/password.js";

const TEST_PASSWORD = "OpsPulse-Secure-Password-2026!";

test("Password hashing generates an Argon2id hash", async () => {
  const hash = await hashPassword(TEST_PASSWORD);

  assert.ok(hash.startsWith("$argon2id$"));
  assert.notEqual(hash, TEST_PASSWORD);
});

test("Correct password verification succeeds", async () => {
  const hash = await hashPassword(TEST_PASSWORD);

  assert.equal(await verifyPassword(TEST_PASSWORD, hash), true);
});

test("Incorrect password verification fails", async () => {
  const hash = await hashPassword(TEST_PASSWORD);

  assert.equal(await verifyPassword("Wrong-Password-2026!", hash), false);
});

test("Hashing the same password generates different hashes", async () => {
  const firstHash = await hashPassword(TEST_PASSWORD);
  const secondHash = await hashPassword(TEST_PASSWORD);

  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(TEST_PASSWORD, firstHash), true);
  assert.equal(await verifyPassword(TEST_PASSWORD, secondHash), true);
});

test("Malformed password hashes are rejected safely", async () => {
  assert.equal(await verifyPassword(TEST_PASSWORD, "invalid-hash"), false);
});

test("Passwords shorter than 12 characters are rejected", () => {
  assert.throws(
    () => validatePasswordStrength("Short123!"),
    /between 12 and 128 characters/,
  );
});

test("Passwords longer than 128 characters are rejected", () => {
  assert.throws(
    () => validatePasswordStrength("A".repeat(129)),
    /between 12 and 128 characters/,
  );
});

test("A 12-character password is accepted", () => {
  assert.doesNotThrow(() => validatePasswordStrength("Abcdef123!xy"));
});

test("A 128-character password is accepted", () => {
  assert.doesNotThrow(() => validatePasswordStrength("A".repeat(128)));
});
