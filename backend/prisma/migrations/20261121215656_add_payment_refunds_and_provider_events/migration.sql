/*
  Warnings:

  - A unique constraint covering the columns `[id,organizationId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

ALTER TYPE "PaymentMethod" ADD VALUE 'UPI';
ALTER TYPE "PaymentMethod" ADD VALUE 'NET_BANKING';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "requestFingerprint" VARCHAR(64);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(19,4) NOT NULL,
    "provider" VARCHAR(100),
    "providerReference" VARCHAR(255),
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "reason" TEXT,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "eventId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(150) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "signatureVerifiedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentRefund_organizationId_paymentId_createdAt_idx" ON "PaymentRefund"("organizationId", "paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRefund_organizationId_status_createdAt_idx" ON "PaymentRefund"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_id_organizationId_key" ON "PaymentRefund"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_organizationId_idempotencyKey_key" ON "PaymentRefund"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_organizationId_provider_providerReference_key" ON "PaymentRefund"("organizationId", "provider", "providerReference");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_organizationId_paymentId_createdAt_idx" ON "PaymentProviderEvent"("organizationId", "paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_organizationId_processedAt_idx" ON "PaymentProviderEvent"("organizationId", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderEvent_organizationId_provider_eventId_key" ON "PaymentProviderEvent"("organizationId", "provider", "eventId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_expiresAt_idx" ON "Payment"("organizationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_organizationId_key" ON "Payment"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_organizationId_fkey" FOREIGN KEY ("paymentId", "organizationId") REFERENCES "Payment"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_paymentId_organizationId_fkey" FOREIGN KEY ("paymentId", "organizationId") REFERENCES "Payment"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add payment refund integrity constraints
ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_amount_positive_check"
CHECK ("amount" > 0);

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_terminal_status_processed_check"
CHECK (
    "status" NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED')
    OR "processedAt" IS NOT NULL
);

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_idempotency_key_nonempty_check"
CHECK (length(trim("idempotencyKey")) > 0);

-- Add provider event integrity constraints
ALTER TABLE "PaymentProviderEvent"
ADD CONSTRAINT "PaymentProviderEvent_payload_hash_format_check"
CHECK ("payloadHash" ~ '^[a-f0-9]{64}$');

ALTER TABLE "PaymentProviderEvent"
ADD CONSTRAINT "PaymentProviderEvent_required_fields_nonempty_check"
CHECK (
    length(trim("provider")) > 0
    AND length(trim("eventId")) > 0
    AND length(trim("eventType")) > 0
);
