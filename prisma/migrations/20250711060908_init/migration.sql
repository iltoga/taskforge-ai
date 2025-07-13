-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "size" INTEGER NOT NULL,
    "extension" VARCHAR(16) NOT NULL,
    "fileType" VARCHAR(32) NOT NULL,
    "mimeType" VARCHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "rawOcrText" TEXT,
    "rawLlmText" TEXT,
    "category" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passport" (
    "id" SERIAL NOT NULL,
    "passport_number" VARCHAR(32) NOT NULL,
    "surname" CITEXT NOT NULL,
    "given_names" CITEXT NOT NULL,
    "nationality" VARCHAR(64) NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "sex" CHAR(1) NOT NULL,
    "place_of_birth" VARCHAR(128) NOT NULL,
    "date_of_issue" TIMESTAMP(3) NOT NULL,
    "date_of_expiry" TIMESTAMP(3) NOT NULL,
    "issuing_authority" VARCHAR(128) NOT NULL,
    "holder_signature_present" BOOLEAN NOT NULL,
    "residence" VARCHAR(128),
    "height_cm" INTEGER,
    "eye_color" VARCHAR(32),
    "type" VARCHAR(64) NOT NULL,
    "documentId" INTEGER,

    CONSTRAINT "Passport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_name_key" ON "Document"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Passport_documentId_key" ON "Passport"("documentId");

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
