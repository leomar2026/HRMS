import { LoginForm } from "./LoginForm";
import { Suspense } from "react";
import { getPublicBranding } from "@/lib/publicBranding";

export default async function LoginPage() {
  const branding = await getPublicBranding();

  return (
    <main className="auth-page">
      <Suspense>
        <LoginForm branding={branding} />
      </Suspense>
    </main>
  );
}
