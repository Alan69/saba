-- CreateTable: per-employee service price override
CREATE TABLE "employee_service_prices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_service_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_service_prices_employee_id_service_id_key" ON "employee_service_prices"("employee_id", "service_id");
CREATE INDEX "employee_service_prices_company_id_service_id_idx" ON "employee_service_prices"("company_id", "service_id");

ALTER TABLE "employee_service_prices" ADD CONSTRAINT "employee_service_prices_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_service_prices" ADD CONSTRAINT "employee_service_prices_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
