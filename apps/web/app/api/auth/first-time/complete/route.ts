import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const body = await request.json();
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const isLocalPreview = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const response = await fetch(`${apiUrl}/api/auth/first-time/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  if (data.token) {
    const cookieStore = await cookies();
    cookieStore.set("hrms_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !isLocalPreview,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8
    });
  }

  return NextResponse.json({ user: data.user, redirectTo: data.redirectTo ?? "/employee/dashboard" });
}
