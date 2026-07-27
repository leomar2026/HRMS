import { EmployeeCreateForm } from "@/components/EmployeeCreateForm";
import { apiFetch } from "@/lib/api";

type Department = {
  id: string;
  name: string;
  code: string;
};

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

type EmployeeResponse = {
  items: Employee[];
  total: number;
};

type MasterData = {
  id: string;
  type: string;
  code?: string | null;
  name: string;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
};

type SelectOption = {
  label: string;
  value: string;
};

const fallbackOptions = {
  jobTitles: ["IT Administrator", "HRMS Administrator", "Operations Specialist", "Operations Manager", "Finance Manager", "Sales Engineer", "Technician"],
  branches: ["Jeddah", "Riyadh", "Dammam"],
  locations: ["Jeddah", "Riyadh", "Dammam", "Makkah", "Factory"],
  employeeTypes: ["Full-time", "Part-time", "Temporary", "Probation", "Intern"],
  contractTypes: ["Unlimited", "Limited", "Fixed Term", "Project Based"]
};

function fromFallback(values: string[]): SelectOption[] {
  return values.map((value) => ({ label: value, value }));
}

function masterOptions(records: MasterData[], type: string, fallback: string[], valueFromMetadata?: string): SelectOption[] {
  const options = records
    .filter((record) => record.type === type && record.active !== false)
    .map((record) => {
      const metadataValue = valueFromMetadata && record.metadata ? record.metadata[valueFromMetadata] : undefined;
      const value = String(metadataValue || record.name || record.code || "").trim();
      return value ? { label: record.name, value } : null;
    })
    .filter((option): option is SelectOption => Boolean(option));
  return options.length ? options : fromFallback(fallback);
}

export default async function NewEmployeePage() {
  const [departments, masterData, employeesResponse] = await Promise.all([
    apiFetch<Department[]>("/departments"),
    apiFetch<MasterData[]>("/master-data").catch(() => []),
    apiFetch<EmployeeResponse | Employee[]>("/employees?pageSize=100").catch(() => ({ items: [], total: 0 }))
  ]);
  const managers = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse.items;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Add New Employee</h1>
          <p className="muted">Admin and HR users can create employee records and portal access.</p>
        </div>
      </div>
      <EmployeeCreateForm
        departments={departments}
        managers={managers}
        jobTitles={masterOptions(masterData, "JOB_TITLE", fallbackOptions.jobTitles)}
        branches={masterOptions(masterData, "BRANCH", fallbackOptions.branches)}
        locations={masterOptions(masterData, "LOCATION", fallbackOptions.locations, "location")}
        employeeTypes={masterOptions(masterData, "EMPLOYEE_TYPE", fallbackOptions.employeeTypes)}
        contractTypes={masterOptions(masterData, "CONTRACT_TYPE", fallbackOptions.contractTypes)}
      />
    </>
  );
}
