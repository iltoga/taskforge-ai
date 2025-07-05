-- CreateTable
CREATE TABLE "Passport" (
    "id" SERIAL NOT NULL,
    "passport_number" VARCHAR(32) NOT NULL,
    "surname" VARCHAR(64) NOT NULL,
    "given_names" VARCHAR(64) NOT NULL,
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

    CONSTRAINT "Passport_pkey" PRIMARY KEY ("id")
);
