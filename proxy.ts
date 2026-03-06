import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieName } from "@/lib/auth";
import { verifyToken } from "@/lib/auth";
import type { AuthRole } from "@/lib/auth";

const DASHBOARD_PATH_PREFIX = "/dashboard";
const DASHBOARD_ADMIN_PREFIX = "/dashboard/admin";
const DASHBOARD_EDITOR_PREFIX = "/dashboard/editor";
const DASHBOARD_API_PREFIX = "/api/dashboard";

function isDashboardAdminRoute(pathname: string): boolean {
  return (
    pathname === DASHBOARD_ADMIN_PREFIX ||
    pathname.startsWith(`${DASHBOARD_ADMIN_PREFIX}/`)
  );
}

function isDashboardEditorRoute(pathname: string): boolean {
  return (
    pathname === DASHBOARD_EDITOR_PREFIX ||
    pathname.startsWith(`${DASHBOARD_EDITOR_PREFIX}/`)
  );
}

function isDashboardRoute(pathname: string): boolean {
  return (
    pathname === DASHBOARD_PATH_PREFIX ||
    pathname.startsWith(`${DASHBOARD_PATH_PREFIX}/`)
  );
}

function isDashboardApiRoute(pathname: string): boolean {
  return (
    pathname === DASHBOARD_API_PREFIX ||
    pathname.startsWith(`${DASHBOARD_API_PREFIX}/`)
  );
}

/** ADMIN mới vào được /dashboard/admin. ADMIN và EDITOR vào được /dashboard/editor. */
function canAccessRoute(pathname: string, role: AuthRole): boolean {
  if (isDashboardAdminRoute(pathname)) {
    return role === "ADMIN";
  }
  if (isDashboardEditorRoute(pathname)) {
    return role === "ADMIN" || role === "EDITOR";
  }
  return false;
}

/** API: users chỉ ADMIN; admin chỉ ADMIN; editor cho ADMIN+EDITOR; còn lại ADMIN+EDITOR */
function canAccessDashboardApi(pathname: string, role: AuthRole): boolean {
  if (pathname.startsWith("/api/dashboard/users")) {
    return role === "ADMIN";
  }
  if (pathname.startsWith("/api/dashboard/admin")) {
    return role === "ADMIN";
  }
  if (pathname.startsWith("/api/dashboard/editor")) {
    return role === "ADMIN" || role === "EDITOR";
  }
  return role === "ADMIN" || role === "EDITOR";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isDashboard = isDashboardRoute(pathname);
  const isDashboardApi = isDashboardApiRoute(pathname);

  if (!isDashboard && !isDashboardApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getCookieName())?.value;
  const session = token ? await verifyToken(token) : null;

  // API dashboard
  if (isDashboardApi) {
    if (!session) {
      return NextResponse.json(
        { error: "Chưa đăng nhập" },
        { status: 401 }
      );
    }
    if (!canAccessDashboardApi(pathname, session.role)) {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập" },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // Trang dashboard: chưa đăng nhập → redirect về home
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // /dashboard (exact) → redirect theo role
  if (pathname === DASHBOARD_PATH_PREFIX) {
    if (session.role === "ADMIN") {
      return NextResponse.redirect(new URL(DASHBOARD_ADMIN_PREFIX, request.url));
    }
    if (session.role === "EDITOR") {
      return NextResponse.redirect(new URL(DASHBOARD_EDITOR_PREFIX, request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Kiểm tra quyền theo từng prefix
  if (!canAccessRoute(pathname, session.role)) {
    if (session.role === "EDITOR") {
      return NextResponse.redirect(new URL(DASHBOARD_EDITOR_PREFIX, request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/api/dashboard",
    "/api/dashboard/:path*",
  ],
};
