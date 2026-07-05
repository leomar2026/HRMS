import { LoginForm } from "./LoginForm";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
