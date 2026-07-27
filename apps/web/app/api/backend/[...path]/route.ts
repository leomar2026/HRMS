import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("hrms_token")?.value;
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const isLocalPreview = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const target = `${apiUrl}/api/${params.path.join("/")}${url.search}`;
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  const response = await fetch(target, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("Content-Type") ?? "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body
  });

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    const nextResponse = NextResponse.json(data, { status: response.status });
    if (response.ok && params.path.join("/") === "auth/change-password" && data?.token) {
      nextResponse.cookies.set("hrms_token", data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" && !isLocalPreview,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 30
      });
    }
    return nextResponse;
  }

  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": response.headers.get("Content-Disposition") ?? ""
    }
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
