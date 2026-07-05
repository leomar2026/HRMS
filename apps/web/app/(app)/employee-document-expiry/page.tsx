import { apiFetch } from "@/lib/api";

type EmployeeResponse = { items: Array<{ id: string; employeeCode: string; firstName: string; lastName: string; iqamaExpiryDate?: string; passportExpiryDate?: string; visaExpiryDate?: string; contractExpiryDate?: string; medicalInsuranceExpiryDate?: string; department: { name: string } }> };

export default async function EmployeeDocumentExpiryPage() {
  const response = await apiFetch<EmployeeResponse>("/employees?pageSize=100");
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">Employee Document Expiry</h1><p className="muted">Track iqama, passport, visa, contract, and medical insurance expiry dates.</p></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Iqama</th><th>Passport</th><th>Visa</th><th>Contract</th><th>Medical Insurance</th></tr></thead>
          <tbody>{response.items.map((e) => <tr key={e.id}><td>{e.employeeCode} - {e.firstName} {e.lastName}</td><td>{e.department.name}</td><td>{e.iqamaExpiryDate ? new Date(e.iqamaExpiryDate).toLocaleDateString() : "-"}</td><td>{e.passportExpiryDate ? new Date(e.passportExpiryDate).toLocaleDateString() : "-"}</td><td>{e.visaExpiryDate ? new Date(e.visaExpiryDate).toLocaleDateString() : "-"}</td><td>{e.contractExpiryDate ? new Date(e.contractExpiryDate).toLocaleDateString() : "-"}</td><td>{e.medicalInsuranceExpiryDate ? new Date(e.medicalInsuranceExpiryDate).toLocaleDateString() : "-"}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
