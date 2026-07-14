import { MobileAttendancePunch } from "@/components/MobileAttendancePunch";
import { TableToolbar } from "@/components/DataTableControls";
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

export default async function MobileAttendancePage() {
  const config = await apiFetch<MobileConfig>("/biometrics/mobile-config");

  return (
    <>
      <TableToolbar
        title="Mobile Time In"
        count={`${config.sites.length} mobile sites`}
        actions={[
          { label: "Biometric Devices", href: "/biometric-devices", icon: "columns" },
          { label: "Attendance Records", href: "/biometric-attendance", icon: "more" },
          { label: "Refresh", href: "/mobile-attendance", icon: "refresh" }
        ]}
        searchPlaceholder="Search mobile attendance..."
      />
      <MobileAttendancePunch config={config} />
    </>
  );
}
