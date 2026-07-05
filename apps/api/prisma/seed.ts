import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const defaultLeaveWorkflowSteps = [
  { stage: "PENDING_MANAGER_APPROVAL", role: "DEPARTMENT_MANAGER", label: "Direct Manager", active: true },
  { stage: "PENDING_OM_APPROVAL", role: "OPERATIONS_MANAGER", label: "Operations Manager", active: true },
  { stage: "PENDING_HR_MANAGER_APPROVAL", role: "HR_MANAGER", label: "HR Manager", active: true }
];

async function main() {
  const department = await prisma.department.upsert({
    where: { code: "HR" },
    update: {},
    create: { code: "HR", name: "Human Resources" }
  });

  const employee = await prisma.employee.upsert({
    where: { employeeCode: "EMP-001" },
    update: {},
    create: {
      employeeCode: "EMP-001",
      nationalId: "1000000001",
      firstName: "Admin",
      lastName: "User",
      email: "admin@company.sa",
      phone: "+966500000000",
      jobTitle: "HRMS Administrator",
      joiningDate: new Date("2026-01-01"),
      basicSalary: 12000,
      housingAllowance: 3000,
      transportAllowance: 1000,
      otherAllowance: 0,
      departmentId: department.id
    }
  });

  const passwordHash = await bcrypt.hash("Admin123!", Number(process.env.BCRYPT_ROUNDS ?? 12));

  await prisma.user.upsert({
    where: { email: "admin@company.sa" },
    update: { passwordHash, role: Role.ADMIN, employeeId: employee.id, portalStatus: "ACTIVE" },
    create: {
      email: "admin@company.sa",
      passwordHash,
      role: Role.ADMIN,
      employeeId: employee.id,
      portalStatus: "ACTIVE"
    }
  });

  const staffDepartment = await prisma.department.upsert({
    where: { code: "OPS" },
    update: {},
    create: { code: "OPS", name: "Operations" }
  });

  const approvalDepartments = [
    { code: "PPS", name: "Power Protection - Pre Sales" },
    { code: "PAS", name: "Power Protection - After Sales" },
    { code: "LC", name: "Low Current" },
    { code: "SAL", name: "Sales" },
    { code: "FIN", name: "Finance" },
    { code: "IT", name: "IT" },
    { code: "ADM", name: "Administrative" }
  ];

  const allWorkflowDepartments = [department, staffDepartment];
  for (const item of approvalDepartments) {
    const seededDepartment = await prisma.department.upsert({
      where: { code: item.code },
      update: { name: item.name },
      create: item
    });
    allWorkflowDepartments.push(seededDepartment);
  }

  for (const workflowDepartment of allWorkflowDepartments) {
    const existing = await prisma.approvalWorkflow.findFirst({ where: { module: "LEAVE", departmentId: workflowDepartment.id } });
    if (existing) {
      await prisma.approvalWorkflow.update({
        where: { id: existing.id },
        data: { name: `${workflowDepartment.name} Leave Approval`, active: true }
      });
    } else {
      await prisma.approvalWorkflow.create({
        data: {
          module: "LEAVE",
          name: `${workflowDepartment.name} Leave Approval`,
          departmentId: workflowDepartment.id,
          active: true,
          steps: defaultLeaveWorkflowSteps
        }
      });
    }
  }

  const managerEmployee = await prisma.employee.upsert({
    where: { employeeCode: "EMP-010" },
    update: { email: "manager@company.com", departmentId: staffDepartment.id },
    create: {
      employeeCode: "EMP-010",
      nationalId: "1000000010",
      firstName: "Manager",
      lastName: "User",
      email: "manager@company.com",
      phone: "+966533333333",
      jobTitle: "Operations Manager",
      joiningDate: new Date("2026-01-15"),
      basicSalary: 15000,
      housingAllowance: 4000,
      transportAllowance: 1200,
      otherAllowance: 0,
      departmentId: staffDepartment.id
    }
  });

  const staffEmployee = await prisma.employee.upsert({
    where: { employeeCode: "EMP-002" },
    update: {
      email: "employee@company.com",
      phone: "+966511111111",
      emergencyContact: "+966522222222",
      address: "Riyadh, Saudi Arabia",
      managerId: managerEmployee.id
    },
    create: {
      employeeCode: "EMP-002",
      nationalId: "1000000002",
      firstName: "Employee",
      lastName: "User",
      email: "employee@company.com",
      phone: "+966511111111",
      emergencyContact: "+966522222222",
      address: "Riyadh, Saudi Arabia",
      jobTitle: "Operations Specialist",
      joiningDate: new Date("2026-02-01"),
      basicSalary: 8000,
      housingAllowance: 2000,
      transportAllowance: 800,
      otherAllowance: 0,
      departmentId: staffDepartment.id,
      managerId: managerEmployee.id
    }
  });

  const omEmployee = await prisma.employee.upsert({
    where: { employeeCode: "EMP-020" },
    update: { email: "om@company.com", departmentId: staffDepartment.id },
    create: {
      employeeCode: "EMP-020",
      nationalId: "1000000020",
      firstName: "Operations",
      lastName: "Manager",
      email: "om@company.com",
      phone: "+966544444444",
      jobTitle: "Operations Manager",
      joiningDate: new Date("2026-01-20"),
      basicSalary: 18000,
      housingAllowance: 4500,
      transportAllowance: 1500,
      otherAllowance: 0,
      departmentId: staffDepartment.id
    }
  });

  await prisma.user.upsert({
    where: { email: "manager@company.com" },
    update: {
      passwordHash: await bcrypt.hash("Manager@123", Number(process.env.BCRYPT_ROUNDS ?? 12)),
      role: Role.DEPARTMENT_MANAGER,
      employeeId: managerEmployee.id,
      portalStatus: "ACTIVE"
    },
    create: {
      email: "manager@company.com",
      passwordHash: await bcrypt.hash("Manager@123", Number(process.env.BCRYPT_ROUNDS ?? 12)),
      role: Role.DEPARTMENT_MANAGER,
      employeeId: managerEmployee.id,
      portalStatus: "ACTIVE"
    }
  });

  await prisma.user.upsert({
    where: { email: "employee@company.com" },
    update: {
      passwordHash: await bcrypt.hash("Employee@123", Number(process.env.BCRYPT_ROUNDS ?? 12)),
      role: Role.EMPLOYEE,
      employeeId: staffEmployee.id,
      portalStatus: "ACTIVE"
    },
    create: {
      email: "employee@company.com",
      passwordHash: await bcrypt.hash("Employee@123", Number(process.env.BCRYPT_ROUNDS ?? 12)),
      role: Role.EMPLOYEE,
      employeeId: staffEmployee.id,
      portalStatus: "ACTIVE"
    }
  });

  await prisma.user.upsert({
    where: { email: "om@company.com" },
    update: {
      passwordHash: await bcrypt.hash("Om@12345", Number(process.env.BCRYPT_ROUNDS ?? 12)),
      role: Role.OPERATIONS_MANAGER,
      employeeId: omEmployee.id,
      portalStatus: "ACTIVE"
    },
    create: {
      email: "om@company.com",
      passwordHash: await bcrypt.hash("Om@12345", Number(process.env.BCRYPT_ROUNDS ?? 12)),
      role: Role.OPERATIONS_MANAGER,
      employeeId: omEmployee.id,
      portalStatus: "ACTIVE"
    }
  });

  await prisma.announcement.upsert({
    where: { id: "company-welcome-announcement" },
    update: {
      title: "Welcome to Company Portal",
      body: "Employee self-service is now available for profile, attendance, leave, payslips, and company announcements."
    },
    create: {
      id: "company-welcome-announcement",
      title: "Welcome to Company Portal",
      body: "Employee self-service is now available for profile, attendance, leave, payslips, and company announcements."
    }
  });

  const masterData = [
    ["BRANCH", "RUH", "Riyadh Head Office"],
    ["JOB_TITLE", "OPS-SPEC", "Operations Specialist"],
    ["GRADE", "G5", "Grade 5"],
    ["COST_CENTER", "HR-001", "Human Resources"],
    ["LEAVE_TYPE", "ANNUAL", "Annual Leave"],
    ["SHIFT", "DAY", "Day Shift"],
    ["BANK", "ALRAJHI", "Al Rajhi Bank"],
    ["DOCUMENT_TYPE", "IQAMA", "Iqama Copy"]
  ];

  for (const [type, code, name] of masterData) {
    await prisma.masterData.upsert({
      where: { type_code: { type, code } },
      update: { name },
      create: { type, code, name }
    });
  }

  const modules = ["Employees", "Leave", "Attendance", "Payroll", "Reports", "Government", "Master Data"];
  for (const module of modules) {
    await prisma.rolePermission.upsert({
      where: { role_module: { role: Role.ADMIN, module } },
      update: {
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canReject: true,
        canPrint: true,
        canExportExcel: true,
        canExportPdf: true,
        canAccessConfidentialSalary: true,
        canAccessEmployeeDocuments: true,
        canAccessGovernmentIntegrations: true
      },
      create: {
        role: Role.ADMIN,
        module,
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canReject: true,
        canPrint: true,
        canExportExcel: true,
        canExportPdf: true,
        canAccessConfidentialSalary: true,
        canAccessEmployeeDocuments: true,
        canAccessGovernmentIntegrations: true
      }
    });
  }

  for (const provider of ["GOSI", "MUDAD", "QIWA"]) {
    await prisma.governmentIntegrationSetting.upsert({
      where: { provider },
      update: { environment: "SANDBOX" },
      create: { provider, environment: "SANDBOX", enabled: false }
    });
  }

  const emailTemplates = [
    ["LEAVE_SUBMITTED", "Leave request submitted", "Your leave request {{leave_request_number}} has been submitted and is pending Manager approval."],
    ["LEAVE_PENDING_MANAGER", "Leave approval pending", "{{employee_name}} submitted leave request {{leave_request_number}}. {{approval_link}}"],
    ["LEAVE_MANAGER_APPROVE", "Leave approved by Manager", "Your leave request {{leave_request_number}} has been approved by your Manager and is pending OM approval."],
    ["LEAVE_OM_APPROVE", "Leave approved by OM", "Your leave request {{leave_request_number}} has been approved by OM and is pending HR Manager approval."],
    ["LEAVE_HR_MANAGER_APPROVE", "Leave Final Approved", "Your leave request {{leave_request_number}} has been Final Approved. Updated balance: {{updated_balance}}."],
    ["LEAVE_REJECTED", "Leave request rejected", "Your leave request {{leave_request_number}} was rejected by {{approver_role}}. Comments: {{approval_comments}}"],
    ["LEAVE_RETURNED", "Leave request returned for correction", "Your leave request {{leave_request_number}} was returned by {{approver_role}}. Comments: {{approval_comments}}"]
  ];

  for (const [code, subject, body] of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { code },
      update: { subject, body, active: true },
      create: { code, subject, body, active: true }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
