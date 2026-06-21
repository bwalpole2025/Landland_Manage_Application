-- CreateEnum
CREATE TYPE "LicenceType" AS ENUM ('HMO', 'ADDITIONAL', 'SELECTIVE');

-- CreateEnum
CREATE TYPE "RightToRentStatus" AS ENUM ('UNLIMITED', 'TIME_LIMITED', 'NOT_CHECKED');

-- CreateTable
CREATE TABLE "LicenceRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "LicenceType" NOT NULL,
    "reference" TEXT,
    "grantedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "rightToRentStatus" "RightToRentStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "rightToRentCheckedOn" TIMESTAMP(3),
    "rightToRentRecheckDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hazard" BOOLEAN NOT NULL DEFAULT false,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "isCorrection" BOOLEAN NOT NULL DEFAULT false,
    "correctsId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LicenceRecord_accountId_propertyId_idx" ON "LicenceRecord"("accountId", "propertyId");

-- CreateIndex
CREATE INDEX "TenantRecord_accountId_propertyId_idx" ON "TenantRecord"("accountId", "propertyId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_accountId_propertyId_idx" ON "MaintenanceLog"("accountId", "propertyId");

-- CreateIndex
CREATE INDEX "ActivityLog_accountId_propertyId_createdAt_idx" ON "ActivityLog"("accountId", "propertyId", "createdAt");

-- AddForeignKey
ALTER TABLE "LicenceRecord" ADD CONSTRAINT "LicenceRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRecord" ADD CONSTRAINT "TenantRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only enforcement for ActivityLog: reject UPDATE and DELETE.
CREATE OR REPLACE FUNCTION activitylog_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ActivityLog is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activitylog_no_update BEFORE UPDATE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION activitylog_append_only();

CREATE TRIGGER activitylog_no_delete BEFORE DELETE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION activitylog_append_only();
