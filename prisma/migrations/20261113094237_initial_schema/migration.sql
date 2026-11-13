-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'driver', 'customer');

-- CreateEnum
CREATE TYPE "DeliveryCategory" AS ENUM ('Parcel', 'Restaurant', 'Shop', 'Cargo');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('open', 'negotiating', 'confirmed', 'rejected', 'in_progress', 'failed', 'completed', 'returning', 'returned', 'cancelled', 'refund_requested', 'refund_processed', 'disputed');

-- CreateEnum
CREATE TYPE "FailureReason" AS ENUM ('customer_not_available', 'incorrect_address', 'access_denied', 'package_damaged', 'customer_refused', 'other');

-- CreateEnum
CREATE TYPE "TemperatureControl" AS ENUM ('hot', 'cold', 'frozen', 'room_temperature');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('van', 'small_truck', 'large_truck', 'flatbed');

-- CreateEnum
CREATE TYPE "FragilityLevel" AS ENUM ('fragile', 'standard', 'durable');

-- CreateEnum
CREATE TYPE "PackageSize" AS ENUM ('small', 'medium', 'large', 'extra_large');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MTN_Mobile_Money', 'Airtel_Money');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('requested', 'approved', 'rejected', 'processed');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'under_review', 'resolved', 'closed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "ridesUserId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phoneNumber" VARCHAR(15) NOT NULL,
    "categoryPreferences" "DeliveryCategory"[] DEFAULT ARRAY[]::"DeliveryCategory"[],
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION NOT NULL,
    "pickupLongitude" DOUBLE PRECISION NOT NULL,
    "destinationLatitude" DOUBLE PRECISION NOT NULL,
    "destinationLongitude" DOUBLE PRECISION NOT NULL,
    "estimatedDistanceKm" DOUBLE PRECISION,
    "category" "DeliveryCategory" NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'open',
    "customerPhoneNumber" VARCHAR(15) NOT NULL,
    "recipientPhoneNumber" VARCHAR(15),
    "temperatureControl" "TemperatureControl",
    "preparationTimeMinutes" INTEGER,
    "requiredVehicleType" "VehicleType",
    "cargoWeightKg" DOUBLE PRECISION,
    "cargoDimensionsCm" VARCHAR(100),
    "fragilityLevel" "FragilityLevel",
    "packageSize" "PackageSize",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_offers" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "offeredPriceRWF" DOUBLE PRECISION NOT NULL,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "isRejected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "agreedPriceRWF" DOUBLE PRECISION NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "failureReason" "FailureReason",
    "failureLocation" VARCHAR(100),
    "failedAt" TIMESTAMP(3),
    "returnDistanceKm" DOUBLE PRECISION,
    "returnCompletedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "cancelledBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationFeeRWF" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_tracking" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amountRWF" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "transactionReference" VARCHAR(100),
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "previousStatus" "DeliveryStatus",
    "newStatus" "DeliveryStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "amountRWF" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'requested',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "refundMethod" "PaymentMethod",
    "transactionReference" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceDescription" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "resolutionNotes" TEXT,
    "outcome" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_ridesUserId_key" ON "users"("ridesUserId");

-- CreateIndex
CREATE INDEX "users_ridesUserId_idx" ON "users"("ridesUserId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isAvailable_idx" ON "users"("isAvailable");

-- CreateIndex
CREATE INDEX "delivery_requests_customerId_idx" ON "delivery_requests"("customerId");

-- CreateIndex
CREATE INDEX "delivery_requests_status_idx" ON "delivery_requests"("status");

-- CreateIndex
CREATE INDEX "delivery_requests_category_idx" ON "delivery_requests"("category");

-- CreateIndex
CREATE INDEX "delivery_requests_createdAt_idx" ON "delivery_requests"("createdAt");

-- CreateIndex
CREATE INDEX "price_offers_deliveryRequestId_idx" ON "price_offers"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "price_offers_driverId_idx" ON "price_offers"("driverId");

-- CreateIndex
CREATE INDEX "price_offers_createdAt_idx" ON "price_offers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_deliveryRequestId_key" ON "bookings"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "bookings_driverId_idx" ON "bookings"("driverId");

-- CreateIndex
CREATE INDEX "bookings_confirmedAt_idx" ON "bookings"("confirmedAt");

-- CreateIndex
CREATE INDEX "location_tracking_deliveryRequestId_idx" ON "location_tracking"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "location_tracking_driverId_idx" ON "location_tracking"("driverId");

-- CreateIndex
CREATE INDEX "location_tracking_recordedAt_idx" ON "location_tracking"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_bookingId_key" ON "payment_transactions"("bookingId");

-- CreateIndex
CREATE INDEX "payment_transactions_bookingId_idx" ON "payment_transactions"("bookingId");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_transactionReference_idx" ON "payment_transactions"("transactionReference");

-- CreateIndex
CREATE INDEX "status_history_deliveryRequestId_idx" ON "status_history"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "status_history_changedBy_idx" ON "status_history"("changedBy");

-- CreateIndex
CREATE INDEX "status_history_createdAt_idx" ON "status_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_deliveryRequestId_key" ON "refunds"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "refunds_deliveryRequestId_idx" ON "refunds"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refunds_requestedAt_idx" ON "refunds"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_deliveryRequestId_key" ON "disputes"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "disputes_deliveryRequestId_idx" ON "disputes"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "disputes_initiatorId_idx" ON "disputes"("initiatorId");

-- CreateIndex
CREATE INDEX "disputes_respondentId_idx" ON "disputes"("respondentId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "disputes_raisedAt_idx" ON "disputes"("raisedAt");

-- AddForeignKey
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_offers" ADD CONSTRAINT "price_offers_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "delivery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_offers" ADD CONSTRAINT "price_offers_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "delivery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_tracking" ADD CONSTRAINT "location_tracking_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "delivery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_tracking" ADD CONSTRAINT "location_tracking_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "delivery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "delivery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "delivery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
