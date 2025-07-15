/*
  Warnings:

  - A unique constraint covering the columns `[passport_number]` on the table `Passport` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Passport_passport_number_key" ON "Passport"("passport_number");
