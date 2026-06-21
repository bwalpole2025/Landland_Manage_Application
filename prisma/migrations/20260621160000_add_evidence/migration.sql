-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('GAS_SAFETY', 'EICR', 'EPC', 'INSURANCE', 'DEPOSIT_PROTECTION', 'HMO_LICENCE', 'SELECTIVE_LICENCE', 'OTHER');

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT,
    "issuedOn" TIMESTAMP(3),
    "anniversary" TIMESTAMP(3),
    "proposedExpiresOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evidence_accountId_propertyId_idx" ON "Evidence"("accountId", "propertyId");

-- CreateIndex
CREATE INDEX "Evidence_ownerId_idx" ON "Evidence"("ownerId");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
