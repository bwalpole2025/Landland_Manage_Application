-- CreateTable
CREATE TABLE "DepositRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "scheme" TEXT,
    "depositGBP" INTEGER,
    "receivedOn" TIMESTAMP(3),
    "protectedOn" TIMESTAMP(3),
    "prescribedInfoServedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PERIODIC_ASSURED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "writtenTermsProvidedOn" TIMESTAMP(3),
    "informationProvidedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositRecord_accountId_propertyId_key" ON "DepositRecord"("accountId", "propertyId");

-- CreateIndex
CREATE INDEX "DepositRecord_accountId_idx" ON "DepositRecord"("accountId");

-- CreateIndex
CREATE INDEX "TenancyRecord_accountId_propertyId_idx" ON "TenancyRecord"("accountId", "propertyId");

-- AddForeignKey
ALTER TABLE "DepositRecord" ADD CONSTRAINT "DepositRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyRecord" ADD CONSTRAINT "TenancyRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
