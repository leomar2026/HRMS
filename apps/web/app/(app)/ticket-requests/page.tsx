import { PrintDocumentActions, TableToolbar } from "@/components/DataTableControls";
import { TicketRequestForm } from "@/components/TravelFinanceActions";
import { WorkflowDecisionButtons } from "@/components/ExtendedHrmsActions";
import { apiFetch } from "@/lib/api";

type Leave = { id: string; requestNumber: string; startDate: string; endDate: string; returnToWorkDate?: string; destinationCountry?: string; destinationCity?: string; status: string };
type Ticket = { id: string; requestNumber: string; arrivalCountry: string; arrivalCity: string; preferredDepartureDate: string; preferredReturnDate?: string; ticketType: string; estimatedTicketCost: string; status: string; currentApprover?: string; bookingReference?: string; employee: { employeeCode: string; firstName: string; lastName: string; department: { name: string } }; leaveRequest: { requestNumber: string } };

export default async function TicketRequestsPage() {
  const [tickets, leaves] = await Promise.all([apiFetch<Ticket[]>("/ticket-requests"), apiFetch<Leave[]>("/leaves")]);
  const annualLeaves = leaves.filter((leave) => leave.status !== "REJECTED");
  return (
    <>
      <TableToolbar title="Ticket Requests" count={`${tickets.length} records`} searchPlaceholder="Search ticket requests" actions={[{ label: "Export CSV", href: "/api/backend/ticket-requests/export.csv", icon: "export" }, { label: "Export Excel", href: "/api/backend/ticket-requests/export.xlsx", icon: "export" }]} />
      <TicketRequestForm leaves={annualLeaves} />
      <div style={{ height: 16 }} />
      <div className="table-wrap">
        <table>
          <thead><tr><th><input aria-label="Select tickets" type="checkbox" /></th><th className="freeze-col">Ticket Request No.</th><th>Linked Leave</th><th>Employee</th><th>Department</th><th>Destination</th><th>Departure</th><th>Return</th><th>Ticket Type</th><th>Estimated Cost</th><th>Status</th><th>Approver</th><th>Booking Ref</th><th>Actions</th></tr></thead>
          <tbody>
            {tickets.map((ticket) => <tr key={ticket.id}><td><input aria-label={`Select ${ticket.requestNumber}`} type="checkbox" /></td><td className="freeze-col">{ticket.requestNumber}</td><td>{ticket.leaveRequest.requestNumber}</td><td>{ticket.employee.employeeCode} - {ticket.employee.firstName} {ticket.employee.lastName}</td><td>{ticket.employee.department.name}</td><td>{ticket.arrivalCity}, {ticket.arrivalCountry}</td><td>{new Date(ticket.preferredDepartureDate).toLocaleDateString()}</td><td>{ticket.preferredReturnDate ? new Date(ticket.preferredReturnDate).toLocaleDateString() : "-"}</td><td>{ticket.ticketType}</td><td>{ticket.estimatedTicketCost}</td><td><span className="status">{ticket.status}</span></td><td>{ticket.currentApprover ?? "-"}</td><td>{ticket.bookingReference ?? "-"}</td><td><PrintDocumentActions module="ticket-requests" id={ticket.id} /><WorkflowDecisionButtons modulePath="ticket-requests" id={ticket.id} /></td></tr>)}
            {tickets.length === 0 ? <tr><td colSpan={14}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
