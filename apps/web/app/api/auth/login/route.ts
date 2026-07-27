import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const body = await request.json();
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const isLocalPreview = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  let response: Response;
  let data: { message?: string; token?: string; user?: unknown; redirectTo?: string; forcePasswordChange?: boolean };

  try {
    response = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    data = await response.json().catch(() => ({ message: "Invalid Employee ID or password." }));
  } catch {
    return NextResponse.json({ message: "Login service is not available. Please try again." }, { status: 503 });
  }

  if (!response.ok) {
    const message = response.status === 401 || response.status === 404 ? "Invalid Employee ID or password." : data.message ?? "Unable to login. Please try again.";
    return NextResponse.json({ message }, { status: response.status });
  }

  if (!data.token) {
    return NextResponse.json({ message: "Login service did not return a session token. Please try again." }, { status: 502 });
  }

  const cookieStore = await cookies();
  cookieStore.set("hrms_token", data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !isLocalPreview,
    sameSite: "lax",
    path: "/",
    maxAge: body.rememberMe ? 60 * 60 * 8 : 60 * 30
  });

  return NextResponse.json({ user: data.user, redirectTo: data.redirectTo, forcePasswordChange: data.forcePasswordChange });
}
