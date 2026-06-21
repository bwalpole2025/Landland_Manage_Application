-- AlterTable: subscription / billing fields on Account
ALTER TABLE "Account" ADD COLUMN "billingStartsAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN "paymentMethodBrand" TEXT;
ALTER TABLE "Account" ADD COLUMN "paymentMethodLast4" TEXT;
ALTER TABLE "Account" ADD COLUMN "billingCustomerId" TEXT;
ALTER TABLE "Account" ADD COLUMN "billingSubscriptionId" TEXT;
ALTER TABLE "Account" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
