-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('IDLE', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BotType" AS ENUM ('CHEAP', 'PREMIUM', 'ALGO');

-- CreateEnum
CREATE TYPE "TradeAction" AS ENUM ('BUY', 'SELL', 'HOLD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "tokens" INTEGER NOT NULL,
    "sentiment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationConfig" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "startCapital" DOUBLE PRECISION NOT NULL,
    "cheapModelId" TEXT NOT NULL,
    "premiumModelId" TEXT NOT NULL,
    "useReddit" BOOLEAN NOT NULL DEFAULT false,
    "status" "SimulationStatus" NOT NULL DEFAULT 'IDLE',
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "sentimentReason" TEXT NOT NULL,
    "rsi" DOUBLE PRECISION,
    "macd" DOUBLE PRECISION,
    "redditHype" DOUBLE PRECISION,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotDecision" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "botType" "BotType" NOT NULL,
    "action" "TradeAction" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "algoConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "botType" "BotType" NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "avgBuyPrice" DOUBLE PRECISION,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE INDEX "SimulationConfig_status_idx" ON "SimulationConfig"("status");

-- CreateIndex
CREATE INDEX "MarketSnapshot_simulationId_timestamp_idx" ON "MarketSnapshot"("simulationId", "timestamp");

-- CreateIndex
CREATE INDEX "BotDecision_botType_createdAt_idx" ON "BotDecision"("botType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_simulationId_botType_key" ON "Portfolio"("simulationId", "botType");

-- AddForeignKey
ALTER TABLE "AnalysisLog" ADD CONSTRAINT "AnalysisLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "SimulationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotDecision" ADD CONSTRAINT "BotDecision_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MarketSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "SimulationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
