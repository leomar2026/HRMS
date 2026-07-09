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
    path === "/employee" ||
    path.startsWith("/employee/");

  if (!token && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
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
    "/announcements/:path*",
    "/group-management/:path*",
    "/admin-password-reset/:path*",
    "/performance-appraisals/:path*",
    "/manager/:path*",
    "/employee/:path*"
  ]
};
