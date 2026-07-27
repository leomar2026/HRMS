ALTER TABLE "Employee"
ADD COLUMN "departmentHeadId" TEXT,
ADD COLUMN "omId" TEXT,
ADD COLUMN "hrManagerId" TEXT,
ADD COLUMN "alternateManagerId" TEXT;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentHeadId_fkey" FOREIGN KEY ("departmentHeadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_omId_fkey" FOREIGN KEY ("omId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_hrManagerId_fkey" FOREIGN KEY ("hrManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_alternateManagerId_fkey" FOREIGN KEY ("alternateManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Department"
ADD COLUMN "nameArabic" TEXT,
ADD COLUMN "company" TEXT,
ADD COLUMN "branch" TEXT,
ADD COLUMN "parentDepartmentId" TEXT,
ADD COLUMN "departmentHeadId" TEXT,
ADD COLUMN "defaultReportingManagerId" TEXT,
ADD COLUMN "omId" TEXT,
ADD COLUMN "hrManagerId" TEXT,
ADD COLUMN "costCenter" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "remarks" TEXT;

ALTER TABLE "Department" ADD CONSTRAINT "Department_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_departmentHeadId_fkey" FOREIGN KEY ("departmentHeadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_defaultReportingManagerId_fkey" FOREIGN KEY ("defaultReportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_omId_fkey" FOREIGN KEY ("omId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_hrManagerId_fkey" FOREIGN KEY ("hrManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DepartmentReportingSetup" (
  "id" TEXT NOT NULL,
  "company" TEXT,
  "branch" TEXT,
  "departmentId" TEXT NOT NULL,
  "departmentHeadId" TEXT,
  "reportingManagerId" TEXT,
  "omId" TEXT,
  "hrManagerId" TEXT,
  "backupManagerId" TEXT,
  "effectiveStartDate" TIMESTAMP(3) NOT NULL,
  "effectiveEndDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "defaultReportingManager" BOOLEAN NOT NULL DEFAULT true,
  "remarks" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DepartmentReportingSetup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DepartmentReportingSetup" ADD CONSTRAINT "DepartmentReportingSetup_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepartmentReportingSetup" ADD CONSTRAINT "DepartmentReportingSetup_departmentHeadId_fkey" FOREIGN KEY ("departmentHeadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DepartmentReportingSetup" ADD CONSTRAINT "DepartmentReportingSetup_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DepartmentReportingSetup" ADD CONSTRAINT "DepartmentReportingSetup_omId_fkey" FOREIGN KEY ("omId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DepartmentReportingSetup" ADD CONSTRAINT "DepartmentReportingSetup_hrManagerId_fkey" FOREIGN KEY ("hrManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DepartmentReportingSetup" ADD CONSTRAINT "DepartmentReportingSetup_backupManagerId_fkey" FOREIGN KEY ("backupManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DepartmentReportingSetup_departmentId_status_idx" ON "DepartmentReportingSetup"("departmentId", "status");
CREATE INDEX "DepartmentReportingSetup_reportingManagerId_idx" ON "DepartmentReportingSetup"("reportingManagerId");
