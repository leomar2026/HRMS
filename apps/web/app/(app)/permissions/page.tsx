import { PermissionForm } from "@/components/AdminForms";
import { apiFetch } from "@/lib/api";

type Permission = {
  id: string;
  role: string;
  module: string;
  canView?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
  canPrint?: boolean;
  canExportExcel?: boolean;
  canExportPdf?: boolean;
};

export default async function PermissionsPage() {
  const permissions = await apiFetch<Permission[]>("/permissions");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Role Permissions</h1>
          <p className="muted">Configure view, add, edit, delete, approve, print, export, salary, document, and government permissions.</p>
        </div>
      </div>
      <PermissionForm />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Role</th><th>Module</th><th>View</th><th>Add</th><th>Edit</th><th>Delete</th><th>Approve</th><th>Print</th><th>Export</th></tr></thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id}>
                <td>{permission.role}</td>
                <td>{permission.module}</td>
                <td>{permission.canView ? "Yes" : "No"}</td>
                <td>{permission.canAdd ? "Yes" : "No"}</td>
                <td>{permission.canEdit ? "Yes" : "No"}</td>
                <td>{permission.canDelete ? "Yes" : "No"}</td>
                <td>{permission.canApprove ? "Yes" : "No"}</td>
                <td>{permission.canPrint ? "Yes" : "No"}</td>
                <td>{permission.canExportExcel || permission.canExportPdf ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
