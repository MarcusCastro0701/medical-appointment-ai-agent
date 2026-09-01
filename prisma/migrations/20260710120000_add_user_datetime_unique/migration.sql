-- DropIndex
DROP INDEX "Appointment_userId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_userId_datetime_key" ON "Appointment"("userId", "datetime");
