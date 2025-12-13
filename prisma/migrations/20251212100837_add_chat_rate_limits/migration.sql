-- CreateTable
CREATE TABLE "ChatRateLimitMinute" (
    "userId" TEXT NOT NULL,
    "minuteKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRateLimitMinute_pkey" PRIMARY KEY ("userId","minuteKey")
);

-- CreateTable
CREATE TABLE "ChatRateLimitDay" (
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRateLimitDay_pkey" PRIMARY KEY ("userId","dayKey")
);

-- CreateIndex
CREATE INDEX "ChatRateLimitMinute_minuteKey_idx" ON "ChatRateLimitMinute"("minuteKey");

-- CreateIndex
CREATE INDEX "ChatRateLimitDay_dayKey_idx" ON "ChatRateLimitDay"("dayKey");

-- AddForeignKey
ALTER TABLE "ChatRateLimitMinute" ADD CONSTRAINT "ChatRateLimitMinute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRateLimitDay" ADD CONSTRAINT "ChatRateLimitDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
