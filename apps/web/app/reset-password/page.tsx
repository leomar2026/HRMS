import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <ResetPasswordForm token={params.token ?? ""} />
    </main>
  );
}
