import { MobileAttendancePunch } from "@/components/MobileAttendancePunch";
import { apiFetch } from "@/lib/api";

type MobileConfig = {
  timezone: string;
  sites: Array<{
    id: string;
    name: string;
    branch?: string | null;
    location?: string | null;
    timezone: string;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
  }>;
};

export default async function EmployeeMobileAttendancePage() {
  const config = await apiFetch<MobileConfig>("/biometrics/mobile-config");

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Mobile Time In</h1>
          <p className="muted">Use phone biometric or your active login session. GPS is required before time in or time out.</p>
        </div>
      </div>
      <MobileAttendancePunch config={config} employeeMode />
    </>
  );
}
