-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ASSISTANT', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'PORTFOLIO', 'LIMITED_COMPANY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "PortfolioType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BeneficialOwnerType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('FLAT', 'TERRACED', 'SEMI_DETACHED', 'DETACHED', 'HMO', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "RentFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'QUARTERLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "MortgageRepaymentType" AS ENUM ('REPAYMENT', 'INTEREST_ONLY');

-- CreateEnum
CREATE TYPE "TenancyStatus" AS ENUM ('ACTIVE', 'VACANT', 'ENDED');

-- CreateEnum
CREATE TYPE "TenancyBalanceState" AS ENUM ('UP_TO_DATE', 'IN_ARREARS', 'IN_CREDIT');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('RENT', 'OTHER_PROPERTY_INCOME', 'RENT_RATES_INSURANCE', 'REPAIRS_MAINTENANCE', 'FINANCE_COSTS', 'PROFESSIONAL_FEES', 'SERVICES_WAGES', 'OTHER_EXPENSES');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('BANK_FEED', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('GAS_SAFETY', 'EICR', 'EPC', 'INSURANCE', 'TENANCY_AGREEMENT', 'RIGHT_TO_RENT', 'DEPOSIT_PROTECTION', 'MORTGAGE_STATEMENT', 'RECEIPT', 'INVOICE', 'STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaxStatementScope" AS ENUM ('PORTFOLIO', 'OWNER');

-- CreateEnum
CREATE TYPE "BankConnectionStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "MtdObligationStatus" AS ENUM ('OPEN', 'FULFILLED', 'OVERDUE');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "firstTaxYear" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/London',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "notificationEmails" BOOLEAN NOT NULL DEFAULT true,
    "mtdEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "utr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "mobile" TEXT,
    "mobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "numberOfPropertiesManaged" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "delegated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "activeAccountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PortfolioType" NOT NULL DEFAULT 'PERSONAL',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyNumber" TEXT,
    "incorporationDate" TIMESTAMP(3),
    "directorsLoanBalanceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficialOwner" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ownerType" "BeneficialOwnerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "portfolioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeneficialOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyBeneficialOwner" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "beneficialOwnerId" TEXT NOT NULL,
    "ownershipPercentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyBeneficialOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL DEFAULT 'FLAT',
    "bedrooms" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "rentalIncomeMinor" INTEGER,
    "rentalIncomeFrequency" "RentFrequency",
    "currentValuationMinor" INTEGER,
    "purchasePriceMinor" INTEGER,
    "purchaseDate" TIMESTAMP(3),
    "streetViewLat" DOUBLE PRECISION,
    "streetViewLng" DOUBLE PRECISION,
    "streetViewHeading" DOUBLE PRECISION,
    "streetViewPitch" DOUBLE PRECISION,
    "streetViewZoom" DOUBLE PRECISION,
    "epcRating" TEXT,
    "epcScore" INTEGER,
    "epcExpiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mortgage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "balanceMinor" INTEGER NOT NULL,
    "monthlyPaymentMinor" INTEGER NOT NULL,
    "interestRateBps" INTEGER,
    "monthlyInterestMinor" INTEGER,
    "repaymentType" "MortgageRepaymentType" NOT NULL DEFAULT 'REPAYMENT',
    "productName" TEXT,
    "productEndDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mortgage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "status" "TenancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "tenantName" TEXT,
    "tenantEmail" TEXT,
    "rentMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "rentFrequency" "RentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "rentDueDay" INTEGER NOT NULL DEFAULT 1,
    "depositMinor" INTEGER,
    "depositScheme" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextPaymentDate" TIMESTAMP(3),
    "balanceState" "TenancyBalanceState" NOT NULL DEFAULT 'UP_TO_DATE',
    "balanceMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "portfolioId" TEXT,
    "propertyId" TEXT,
    "tenancyId" TEXT,
    "bankAccountId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "rentDueDate" TIMESTAMP(3),
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "direction" "TransactionDirection" NOT NULL,
    "category" "TransactionCategory",
    "subcategory" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "receiptDocumentId" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'BANK_FEED',
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "deactivated" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenancyId" TEXT,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenantId" TEXT,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "documentId" TEXT,
    "propertyId" TEXT,
    "tenancyId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxStatement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "scope" "TaxStatementScope" NOT NULL,
    "portfolioId" TEXT,
    "beneficialOwnerId" TEXT,
    "taxYear" TEXT NOT NULL,
    "totalIncomeMinor" INTEGER NOT NULL,
    "totalExpensesMinor" INTEGER NOT NULL,
    "estimatedTaxMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "maskedNumber" TEXT NOT NULL,
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MtdObligation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "MtdObligationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MtdObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MtdSubmission" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "totalIncomeMinor" INTEGER NOT NULL,
    "totalExpensesMinor" INTEGER NOT NULL,
    "receiptRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MtdSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_accountId_idx" ON "User"("accountId");

-- CreateIndex
CREATE INDEX "Membership_accountId_idx" ON "Membership"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_accountId_key" ON "Membership"("userId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_hashedToken_key" ON "Session"("hashedToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_hashedToken_key" ON "EmailVerificationToken"("hashedToken");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_hashedToken_key" ON "PasswordResetToken"("hashedToken");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Portfolio_accountId_idx" ON "Portfolio"("accountId");

-- CreateIndex
CREATE INDEX "Portfolio_companyId_idx" ON "Portfolio"("companyId");

-- CreateIndex
CREATE INDEX "Company_accountId_idx" ON "Company"("accountId");

-- CreateIndex
CREATE INDEX "BeneficialOwner_accountId_idx" ON "BeneficialOwner"("accountId");

-- CreateIndex
CREATE INDEX "BeneficialOwner_portfolioId_idx" ON "BeneficialOwner"("portfolioId");

-- CreateIndex
CREATE INDEX "PropertyBeneficialOwner_accountId_idx" ON "PropertyBeneficialOwner"("accountId");

-- CreateIndex
CREATE INDEX "PropertyBeneficialOwner_beneficialOwnerId_idx" ON "PropertyBeneficialOwner"("beneficialOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyBeneficialOwner_propertyId_beneficialOwnerId_key" ON "PropertyBeneficialOwner"("propertyId", "beneficialOwnerId");

-- CreateIndex
CREATE INDEX "Property_accountId_idx" ON "Property"("accountId");

-- CreateIndex
CREATE INDEX "Property_portfolioId_idx" ON "Property"("portfolioId");

-- CreateIndex
CREATE INDEX "Mortgage_accountId_idx" ON "Mortgage"("accountId");

-- CreateIndex
CREATE INDEX "Mortgage_propertyId_idx" ON "Mortgage"("propertyId");

-- CreateIndex
CREATE INDEX "Valuation_accountId_idx" ON "Valuation"("accountId");

-- CreateIndex
CREATE INDEX "Valuation_propertyId_idx" ON "Valuation"("propertyId");

-- CreateIndex
CREATE INDEX "Tenancy_accountId_idx" ON "Tenancy"("accountId");

-- CreateIndex
CREATE INDEX "Tenancy_propertyId_idx" ON "Tenancy"("propertyId");

-- CreateIndex
CREATE INDEX "Tenant_accountId_idx" ON "Tenant"("accountId");

-- CreateIndex
CREATE INDEX "Tenant_tenancyId_idx" ON "Tenant"("tenancyId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_propertyId_idx" ON "Transaction"("propertyId");

-- CreateIndex
CREATE INDEX "Transaction_tenancyId_idx" ON "Transaction"("tenancyId");

-- CreateIndex
CREATE INDEX "Transaction_portfolioId_idx" ON "Transaction"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_externalId_key" ON "Transaction"("accountId", "externalId");

-- CreateIndex
CREATE INDEX "Document_accountId_idx" ON "Document"("accountId");

-- CreateIndex
CREATE INDEX "Document_propertyId_idx" ON "Document"("propertyId");

-- CreateIndex
CREATE INDEX "Document_tenancyId_idx" ON "Document"("tenancyId");

-- CreateIndex
CREATE INDEX "Note_accountId_idx" ON "Note"("accountId");

-- CreateIndex
CREATE INDEX "Reminder_accountId_idx" ON "Reminder"("accountId");

-- CreateIndex
CREATE INDEX "Reminder_dueDate_idx" ON "Reminder"("dueDate");

-- CreateIndex
CREATE INDEX "TaxStatement_accountId_idx" ON "TaxStatement"("accountId");

-- CreateIndex
CREATE INDEX "TaxStatement_portfolioId_idx" ON "TaxStatement"("portfolioId");

-- CreateIndex
CREATE INDEX "BankAccount_accountId_idx" ON "BankAccount"("accountId");

-- CreateIndex
CREATE INDEX "MtdObligation_accountId_idx" ON "MtdObligation"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MtdObligation_accountId_taxYear_period_key" ON "MtdObligation"("accountId", "taxYear", "period");

-- CreateIndex
CREATE UNIQUE INDEX "MtdSubmission_obligationId_key" ON "MtdSubmission"("obligationId");

-- CreateIndex
CREATE INDEX "MtdSubmission_accountId_idx" ON "MtdSubmission"("accountId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficialOwner" ADD CONSTRAINT "BeneficialOwner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficialOwner" ADD CONSTRAINT "BeneficialOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficialOwner" ADD CONSTRAINT "BeneficialOwner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficialOwner" ADD CONSTRAINT "BeneficialOwner_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyBeneficialOwner" ADD CONSTRAINT "PropertyBeneficialOwner_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyBeneficialOwner" ADD CONSTRAINT "PropertyBeneficialOwner_beneficialOwnerId_fkey" FOREIGN KEY ("beneficialOwnerId") REFERENCES "BeneficialOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mortgage" ADD CONSTRAINT "Mortgage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mortgage" ADD CONSTRAINT "Mortgage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_receiptDocumentId_fkey" FOREIGN KEY ("receiptDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxStatement" ADD CONSTRAINT "TaxStatement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxStatement" ADD CONSTRAINT "TaxStatement_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxStatement" ADD CONSTRAINT "TaxStatement_beneficialOwnerId_fkey" FOREIGN KEY ("beneficialOwnerId") REFERENCES "BeneficialOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MtdObligation" ADD CONSTRAINT "MtdObligation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MtdSubmission" ADD CONSTRAINT "MtdSubmission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MtdSubmission" ADD CONSTRAINT "MtdSubmission_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "MtdObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
