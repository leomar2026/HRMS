import { BusinessTripForm, WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string };
type EmployeeResponse = { items: Employee[] };
type Trip = {
  id: string;
  requestNumber: string;
  tripType: string;
  destinationCountry?: string;
  destinationCity?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalEstimatedCost: string;
  requestedAdvanceAmount: string;
  status: string;
  currentApprover?: string;
  createdAt: string;
  employee: { employeeCode: string; firstName: string; lastName: string; jobTitle?: string; department: { name: string } };
};

export default async function BusinessTripsPage() {
  const [trips, employeesResponse] = await Promise.all([
    apiFetch<Trip[]>("/business-trips"),
    apiFetch<EmployeeResponse | Employee[]>("/employees?pageSize=100")
  ]);
  const employees = Array.isArray(employeesResponse) ? employeesResponse : employeesResponse.items;

  return (
    <>
      <TableToolbar
        title="Business Trip Management"
        count={`${trips.length} records`}
        searchPlaceholder="Search trip requests"
        actions={[
          { label: "Export CSV", href: "/api/backend/business-trips/export.csv", icon: "export" },
          { label: "Export Excel", href: "/api/backend/business-trips/export.xlsx", icon: "export" }
        ]}
      />
      <BusinessTripForm employees={employees} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select trips" type="checkbox" /></th><th className="freeze-col">Request Number</th><th>Employee</th><th>Department</th><th>Destination</th><th>Trip Type</th><th>Start</th><th>End</th><th>Days</th><th>Estimated Cost</th><th>Advance</th><th>Status</th><th>Current Approver</th><th>Request Date</th><th>Actions</th></tr></thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id}>
                <td><input aria-label={`Select ${trip.requestNumber}`} type="checkbox" /></td>
                <td className="freeze-col">{trip.requestNumber}</td>
                <td>{trip.employee.employeeCode} - {trip.employee.firstName} {trip.employee.lastName}</td>
                <td>{trip.employee.department.name}</td>
                <td>{[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}</td>
                <td>{trip.tripType}</td>
                <td>{new Date(trip.startDate).toLocaleDateString()}</td>
                <td>{new Date(trip.endDate).toLocaleDateString()}</td>
                <td>{trip.totalDays}</td>
                <td>{trip.totalEstimatedCost}</td>
                <td>{trip.requestedAdvanceAmount}</td>
                <td><span className="status">{trip.status}</span></td>
                <td>{trip.currentApprover ?? "-"}</td>
                <td>{new Date(trip.createdAt).toLocaleDateString()}</td>
                <td>
                  <PrintDocumentActions module="business-trips" id={trip.id} />
                  <WorkflowDecisionButtons modulePath="business-trips" id={trip.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
