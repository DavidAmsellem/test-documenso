-- CreateTable
CREATE TABLE "SmsVerificationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "recipientId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SmsVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsVerificationToken_token_key" ON "SmsVerificationToken"("token");

-- CreateIndex
CREATE INDEX "SmsVerificationToken_token_idx" ON "SmsVerificationToken"("token");

-- CreateIndex
CREATE INDEX "SmsVerificationToken_phoneNumber_idx" ON "SmsVerificationToken"("phoneNumber");

-- CreateIndex
CREATE INDEX "SmsVerificationToken_recipientId_idx" ON "SmsVerificationToken"("recipientId");
