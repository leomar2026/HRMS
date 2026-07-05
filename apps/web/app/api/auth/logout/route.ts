import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hrms_token")?.value;
  if (token) {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => undefined);
  }
  cookieStore.delete("hrms_token");
  return NextResponse.json({ ok: true, message: "You have been logged out successfully." });
}
