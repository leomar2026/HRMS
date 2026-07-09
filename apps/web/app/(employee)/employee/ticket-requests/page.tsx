import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { TicketRequestForm } from "@/components/TravelFinanceActions";
import { WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { apiFetch } from "@/lib/api";

type Leave = { id: string; requestNumber: string; startDate: string; endDate: string; returnToWorkDate?: string; destinationCountry?: string; destinationCity?: string; status: string; type: string };
type Ticket = { id: string; requestNumber: string; arrivalCountry: string; arrivalCity: string; preferredDepartureDate: string; preferredReturnDate?: string; ticketType: string; estimatedTicketCost: string; status: string; currentApprover?: string; bookingReference?: string; leaveRequest: { requestNumber: string } };

export default async function EmployeeTicketRequestsPage() {
  const [tickets, leaves] = await Promise.all([apiFetch<Ticket[]>("/ticket-requests"), apiFetch<Leave[]>("/employee/me/leaves")]);
  const annualLeaves = leaves.filter((leave) => leave.type === "ANNUAL");
  return (
    <>
      <TableToolbar title="My Ticket Requests" count={`${tickets.length} records`} searchPlaceholder="Search my ticket requests" actions={[]} />
      <TicketRequestForm leaves={annualLeaves} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ticket Request No.</th><th>Linked Leave</th><th>Destination</th><th>Departure</th><th>Return</th><th>Ticket Type</th><th>Estimated Cost</th><th>Status</th><th>Approver</th><th>Booking Ref</th><th>Actions</th></tr></thead>
          <tbody>
            {tickets.map((ticket) => <tr key={ticket.id}><td>{ticket.requestNumber}</td><td>{ticket.leaveRequest.requestNumber}</td><td>{ticket.arrivalCity}, {ticket.arrivalCountry}</td><td>{new Date(ticket.preferredDepartureDate).toLocaleDateString()}</td><td>{ticket.preferredReturnDate ? new Date(ticket.preferredReturnDate).toLocaleDateString() : "-"}</td><td>{ticket.ticketType}</td><td>{ticket.estimatedTicketCost}</td><td><span className="status">{ticket.status}</span></td><td>{ticket.currentApprover ?? "-"}</td><td>{ticket.bookingReference ?? "-"}</td><td><PrintDocumentActions module="ticket-requests" id={ticket.id} /><WorkflowDecisionButtons modulePath="ticket-requests" id={ticket.id} /></td></tr>)}
            {tickets.length === 0 ? <tr><td colSpan={11}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
