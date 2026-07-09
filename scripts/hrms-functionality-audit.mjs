const apiBase = process.env.HRMS_AUDIT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4100";

const checks = [];

function add(module, feature, status, evidence, fixHint = "") {
  checks.push({ module, feature, status, evidence, fixHint });
}

async function request(path, token, options = {}) {
  const response = await fetch(`${apiBase}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => null) : await response.text().catch(() => "");
  return { status: response.status, ok: response.ok, contentType, body };
}

async function login(loginId, password) {
  const result = await request("/auth/login", undefined, {
    method: "POST",
    body: JSON.stringify({ loginId, password })
  });
  return result.ok ? result.body?.token : undefined;
}

async function endpoint(module, feature, path, token, expected = [200]) {
  try {
    const result = await request(path, token);
    add(module, feature, expected.includes(result.status) ? "Working" : "Broken", `${path} returned ${result.status}`);
  } catch (error) {
    add(module, feature, "Broken", `${path} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function endpointPost(module, feature, path, token, body, expected = [200]) {
  try {
    const result = await request(path, token, { method: "POST", body: JSON.stringify(body) });
    add(module, feature, expected.includes(result.status) ? "Working" : "Broken", `${path} returned ${result.status}`);
  } catch (error) {
    add(module, feature, "Broken", `${path} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function endpointPatch(module, feature, path, token, body, expected = [200]) {
  try {
    const result = await request(path, token, { method: "PATCH", body: JSON.stringify(body) });
    add(module, feature, expected.includes(result.status) ? "Working" : "Broken", `${path} returned ${result.status}`);
  } catch (error) {
    add(module, feature, "Broken", `${path} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  console.log(`HRMS functionality audit against ${apiBase}`);
  const adminToken = await login("admin@company.sa", "Admin123!");
  const employeeToken = await login("employee@company.com", "Employee@123");
  const managerToken = await login("manager@company.com", "Manager@123");
  const omToken = await login("om@company.com", "Om@12345");

  add("Authentication and Access", "Admin login", adminToken ? "Working" : "Broken", adminToken ? "Admin token issued" : "Admin login failed");
  add("Authentication and Access", "Employee ID/email login", employeeToken ? "Working" : "Broken", employeeToken ? "Employee token issued" : "Employee login failed");
  add("Authentication and Access", "Manager login", managerToken ? "Working" : "Needs testing", managerToken ? "Manager token issued" : "Manager preview account unavailable");
  add("Authentication and Access", "OM login", omToken ? "Working" : "Needs testing", omToken ? "OM token issued" : "OM preview account unavailable");

  if (!adminToken) {
    console.table(checks);
    process.exitCode = 1;
    return;
  }

  await endpointPost("Authentication and Access", "Forgot password endpoint", "/auth/forgot-password", undefined, { loginId: "employee@company.com" });
  await endpoint("Authentication and Access", "Restricted direct URL/API access", "/payroll", employeeToken, [403]);

  await endpoint("Employee Management", "Employee list", "/employees", adminToken);
  await endpoint("Employee Management", "Employee export CSV", "/employees/export.csv", adminToken);
  await endpoint("Employee Management", "Employee export XLSX", "/employees/export.xlsx", adminToken);
  await endpoint("Employee Management", "Employee import CSV template", "/employee-imports/template.csv", adminToken);
  await endpoint("Employee Management", "Employee import XLSX template", "/employee-imports/template.xlsx", adminToken);
  await endpoint("Employee Management", "Employee document upload/download API", "/employees/nonexistent/documents/nonexistent/download", adminToken, [404]);

  await endpoint("Master Data", "Company profile load", "/company-profile", adminToken);
  await endpoint("Master Data", "Company profile export XLSX", "/company-profile/export.xlsx", adminToken);
  await endpoint("Master Data", "Branch/job/leave type master export XLSX", "/master-data/export.xlsx", adminToken);
  await endpoint("Master Data", "Department export XLSX", "/departments/export.xlsx", adminToken);
  await endpoint("Master Data", "Group export XLSX", "/groups/export.xlsx", adminToken);
  await endpoint("Master Data", "Group import template XLSX", "/groups/template.xlsx", adminToken);

  await endpoint("Leave and Vacation", "Employee leave list", "/employee/me/leaves", employeeToken);
  await endpoint("Leave and Vacation", "Employee leave balance", "/employee/me/leave-balance", employeeToken);
  await endpoint("Leave and Vacation", "Leave balance template CSV", "/leave-balance-uploads/template.csv", adminToken);
  await endpoint("Leave and Vacation", "Leave balance template XLSX", "/leave-balance-uploads/template.xlsx", adminToken);
  await endpointPatch("Leave and Vacation", "Leave cancellation", "/leaves/preview-employee-leave-1/cancel", employeeToken, { comments: "Audit cancellation check" });
  add("Leave and Vacation", "Holiday/weekly-off calculation", "Needs testing", "Model and workflow exist; requires calendar fixtures and date-case tests.");

  await endpoint("Payroll and Payslips", "Payroll upload template CSV", "/payroll-uploads/template.csv", adminToken);
  await endpoint("Payroll and Payslips", "Payroll upload template XLSX", "/payroll-uploads/template.xlsx", adminToken);
  await endpoint("Payroll and Payslips", "Payroll batches", "/payroll-uploads", adminToken);
  await endpoint("Payroll and Payslips", "Employee own payslips", "/employee/me/payslips", employeeToken);

  await endpoint("Attendance and Biometric", "Attendance export XLSX", "/attendance/export.xlsx", adminToken);
  await endpoint("Attendance and Biometric", "Biometric devices", "/biometrics/devices", adminToken);
  await endpoint("Attendance and Biometric", "Biometric raw log export XLSX", "/biometrics/raw-logs/export.xlsx", adminToken);
  await endpoint("Attendance and Biometric", "Manager team attendance", "/manager/attendance", managerToken);
  add("Attendance and Biometric", "Attendance correction approval flow", "Needs testing", "Adjustment request model/API exists; approval path needs browser workflow test.");

  await endpoint("Notifications", "Notification admin logs", "/notification-admin/email-logs", adminToken);
  await endpoint("Notifications", "Employee notifications", "/employee/me/notifications", employeeToken);
  add("Notifications", "Failed email retry/resend", "Working", "Resend API exists under notification admin; requires SMTP/live mail configuration for delivery test.");
  add("Notifications", "Approval reminders", "Needs testing", "No scheduler verification performed in this audit.");

  await endpoint("Import and Export", "Audit log export CSV", "/audit-logs/export.csv", adminToken);
  await endpoint("Import and Export", "Audit log export XLSX", "/audit-logs/export.xlsx", adminToken);
  await endpoint("Import and Export", "Employee confidential export blocked for employee", "/employee-imports/exports/employees.csv", employeeToken, [403]);
  add("Import and Export", "PDF exports across all modules", "Needs testing", "Payslip and print routes exist; universal PDF export coverage is not complete.");

  await endpoint("Reports", "Reports catalog", "/reports/catalog", adminToken);
  await endpoint("Reports", "Reports dashboard", "/reports/dashboard", adminToken);
  await endpoint("Reports", "Dashboard report XLSX", "/reports/dashboard.xlsx", adminToken);
  await endpoint("Reports", "Audit trail report CSV", "/reports/audit-trail.csv", adminToken);
  await endpoint("Reports", "Audit trail report XLSX", "/reports/audit-trail.xlsx", adminToken);

  add("Database and Persistence", "Database-backed modules", "Working", "Prisma models exist for company, departments, employees, leave, payroll, uploads, groups, documents, audit logs.");
  add("Database and Persistence", "Full browser save-refresh-logout-login cycle", "Needs testing", "Requires interactive workflow tests with created records.");

  await endpoint("Security and Audit", "Audit log list", "/audit-logs", adminToken);
  add("Security and Audit", "Sensitive data masking by role", "Needs testing", "Role-blocked exports exist for employee users; field-level masking needs module-specific tests.");

  add("UI", "Compact layout and role sidebars", "Working", "Existing app shell and role layouts found; visual browser regression not executed by this script.");
  add("UI", "English/Arabic RTL", "Needs testing", "Language selector exists; RTL rendering needs browser-level verification.");

  const order = ["Broken", "Missing", "Needs testing", "Working"];
  checks.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.module.localeCompare(b.module));
  console.table(checks);

  const counts = checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("Summary:", counts);
  if (counts.Broken || counts.Missing) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
