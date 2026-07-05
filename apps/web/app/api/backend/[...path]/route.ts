import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("hrms_token")?.value;
  const url = new URL(request.url);
  const target = `${apiUrl}/api/${params.path.join("/")}${url.search}`;
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
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
    return NextResponse.json(await response.json(), { status: response.status });
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
