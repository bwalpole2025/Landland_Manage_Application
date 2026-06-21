-- CreateTable
CREATE TABLE "ApplicabilityProfile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "propertyType" TEXT,
    "occupants" INTEGER,
    "households" INTEGER,
    "hasGasSupply" BOOLEAN NOT NULL DEFAULT false,
    "selectiveLicensingArea" BOOLEAN NOT NULL DEFAULT false,
    "annualRentGBP" INTEGER,
    "tenantIsIndividual" BOOLEAN NOT NULL DEFAULT true,
    "tenantOnlyOrMainHome" BOOLEAN NOT NULL DEFAULT true,
    "landlordResident" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicabilityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicabilityProfile_accountId_propertyId_key" ON "ApplicabilityProfile"("accountId", "propertyId");

-- CreateIndex
CREATE INDEX "ApplicabilityProfile_accountId_idx" ON "ApplicabilityProfile"("accountId");

-- AddForeignKey
ALTER TABLE "ApplicabilityProfile" ADD CONSTRAINT "ApplicabilityProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
