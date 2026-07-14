import { NextResponse, type NextRequest } from "next/server";

const adminPaths = [
  "/dashboard",
  "/employees",
  "/employee-import",
  "/employee-export",
  "/employee-import-history",
  "/employee-document-expiry",
  "/departments",
  "/company-profile",
  "/attendance",
  "/mobile-attendance",
  "/biometric-devices",
  "/biometric-mapping",
  "/biometric-attendance",
  "/biometric-logs",
  "/leave",
  "/payroll",
  "/payroll-upload",
  "/leave-balance-upload",
  "/compliance",
  "/government-sync",
  "/audit-logs"
  ,"/reports"
  ,"/master-data"
  ,"/permissions"
  ,"/number-series"
  ,"/announcements"
  ,"/group-management"
  ,"/admin-password-reset"
  ,"/performance-appraisals"
];

const managerAllowedAdminPaths = [
  "/performance-appraisals"
];

const managerPaths = [
  "/manager"
];

const employeeSharedPaths = [
  "/mobile-time-in"
];

function decodeJwtPayload(token?: string) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as { role?: string };
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get("hrms_token")?.value;
  const role = decodeJwtPayload(token)?.role;
  const path = request.nextUrl.pathname;
  const isProtected =
    adminPaths.some((adminPath) => path === adminPath || path.startsWith(`${adminPath}/`)) ||
    managerPaths.some((managerPath) => path === managerPath || path.startsWith(`${managerPath}/`)) ||
    employeeSharedPaths.some((employeePath) => path === employeePath || path.startsWith(`${employeePath}/`)) ||
    path === "/employee" ||
    path.startsWith("/employee/");

  if (!token && isProtected) {
    const loginUrl = new URL("/login", request.url);
    if (employeeSharedPaths.some((employeePath) => path === employeePath || path.startsWith(`${employeePath}/`))) {
      loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (role && role !== "EMPLOYEE" && employeeSharedPaths.some((employeePath) => path === employeePath || path.startsWith(`${employeePath}/`))) {
    return NextResponse.redirect(new URL("/mobile-attendance", request.url));
  }

  if (role === "EMPLOYEE" && adminPaths.some((adminPath) => path === adminPath || path.startsWith(`${adminPath}/`))) {
    return NextResponse.redirect(new URL("/employee/dashboard", request.url));
  }

  if (role === "EMPLOYEE" && managerPaths.some((managerPath) => path === managerPath || path.startsWith(`${managerPath}/`))) {
    return NextResponse.redirect(new URL("/employee/dashboard", request.url));
  }

  if (role === "DEPARTMENT_MANAGER" && adminPaths.some((adminPath) => path === adminPath || path.startsWith(`${adminPath}/`)) && !managerAllowedAdminPaths.some((managerPath) => path === managerPath || path.startsWith(`${managerPath}/`))) {
    return NextResponse.redirect(new URL("/manager/dashboard", request.url));
  }

  if (role && !["DEPARTMENT_MANAGER", "HR_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role) && managerPaths.some((managerPath) => path === managerPath || path.startsWith(`${managerPath}/`))) {
    return NextResponse.redirect(new URL("/employee/dashboard", request.url));
  }

  if (role && role !== "EMPLOYEE" && (path === "/employee" || path.startsWith("/employee/"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employees/:path*",
    "/employee-import/:path*",
    "/employee-export/:path*",
    "/employee-import-history/:path*",
    "/employee-document-expiry/:path*",
    "/departments/:path*",
    "/company-profile/:path*",
    "/attendance/:path*",
    "/mobile-attendance/:path*",
    "/biometric-devices/:path*",
    "/biometric-mapping/:path*",
    "/biometric-attendance/:path*",
    "/biometric-logs/:path*",
    "/leave/:path*",
    "/payroll/:path*",
    "/payroll-upload/:path*",
    "/leave-balance-upload/:path*",
    "/compliance/:path*",
    "/government-sync/:path*",
    "/audit-logs/:path*",
    "/reports/:path*",
    "/master-data/:path*",
    "/permissions/:path*",
    "/number-series/:path*",
    "/announcements/:path*",
    "/group-management/:path*",
    "/admin-password-reset/:path*",
    "/performance-appraisals/:path*",
    "/mobile-time-in/:path*",
    "/manager/:path*",
    "/employee/:path*"
  ]
};
