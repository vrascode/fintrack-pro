-- Initial identity schema. Auth and ledger are separate milestones.
-- Hand-authored migration: PostgreSQL execution is an explicit acceptance gate.
BEGIN;

CREATE TYPE "AuthTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_email_normalized" CHECK (
        "email" = lower(btrim("email")) AND char_length("email") > 3
    ),
    CONSTRAINT "User_passwordHash_not_empty" CHECK (char_length("passwordHash") > 0)
);

CREATE TABLE "Session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "deviceName" VARCHAR(100) NOT NULL,
    "accessTokenHash" VARCHAR(64) NOT NULL,
    "accessExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Session_access_hash" CHECK ("accessTokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Session_device_name" CHECK (char_length(btrim("deviceName")) > 0),
    CONSTRAINT "Session_expiry_order" CHECK (
        "createdAt" < "accessExpiresAt" AND
        "accessExpiresAt" <= "expiresAt" AND "expiresAt" <= "absoluteExpiresAt" AND
        "createdAt" <= "lastUsedAt" AND "lastUsedAt" < "absoluteExpiresAt"
    ),
    CONSTRAINT "Session_revoked_time" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt"),
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RefreshToken_hash" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "RefreshToken_expiry" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "RefreshToken_consumed_time" CHECK (
        "consumedAt" IS NULL OR ("consumedAt" >= "createdAt" AND "consumedAt" < "expiresAt")
    ),
    CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId")
        REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuthToken_hash" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "AuthToken_expiry" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "AuthToken_consumed_time" CHECK (
        "consumedAt" IS NULL OR ("consumedAt" >= "createdAt" AND "consumedAt" < "expiresAt")
    ),
    CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_accessTokenHash_key" ON "Session"("accessTokenHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_absoluteExpiresAt_idx" ON "Session"("absoluteExpiresAt");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

COMMIT;
