import { BusinessTripForm, WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { apiFetch } from "@/lib/api";

type Trip = { id: string; requestNumber: string; tripType: string; destinationCountry?: string; destinationCity?: string; startDate: string; endDate: string; totalDays: number; totalEstimatedCost: string; requestedAdvanceAmount: string; status: string; createdAt: string };

export default async function EmployeeBusinessTripsPage() {
  const trips = await apiFetch<Trip[]>("/business-trips");
  return (
    <>
      <TableToolbar title="My Business Trip Requests" count={`${trips.length} records`} searchPlaceholder="Search my trips" actions={[]} />
      <BusinessTripForm employees={[]} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Request No.</th><th>Trip Type</th><th>Destination</th><th>Start</th><th>End</th><th>Days</th><th>Estimated Cost</th><th>Advance</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {trips.map((trip) => <tr key={trip.id}><td>{trip.requestNumber}</td><td>{trip.tripType}</td><td>{[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ")}</td><td>{new Date(trip.startDate).toLocaleDateString()}</td><td>{new Date(trip.endDate).toLocaleDateString()}</td><td>{trip.totalDays}</td><td>{trip.totalEstimatedCost}</td><td>{trip.requestedAdvanceAmount}</td><td><span className="status">{trip.status}</span></td><td><PrintDocumentActions module="business-trips" id={trip.id} /><WorkflowDecisionButtons modulePath="business-trips" id={trip.id} /></td></tr>)}
            {trips.length === 0 ? <tr><td colSpan={10}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
