import { createSignal, onMount, For, Show } from "solid-js";
import { api, ServiceRequestView, Customer, ProductView, WarehouseView } from "../../../api/client";
import { SignaturePad } from "../../ui/SignaturePad";
import { IconPlus, IconRefresh, IconCheck, IconAlert, IconFieldService } from "../../ui/Icons";

export function FieldServiceView() {
  const [requests, setRequests] = createSignal<ServiceRequestView[]>([]);
  const [customers, setCustomers] = createSignal<Customer[]>([]);
  const [products, setProducts] = createSignal<ProductView[]>([]);
  const [warehouses, setWarehouses] = createSignal<WarehouseView[]>([]);

  const [selectedTicket, setSelectedTicket] = createSignal<ServiceRequestView | null>(null);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showSignModal, setShowSignModal] = createSignal(false);
  const [showSpareModal, setShowSpareModal] = createSignal(false);

  // New Complaint Form State
  const [ticketNo, setTicketNo] = createSignal(`SR-${Date.now().toString().slice(-5)}`);
  const [customerId, setCustomerId] = createSignal("");
  const [productName, setProductName] = createSignal("");
  const [productSerial, setProductSerial] = createSignal("");
  const [priority, setPriority] = createSignal("High");
  const [issueDescription, setIssueDescription] = createSignal("");

  // Sign-Off State
  const [diagnosis, setDiagnosis] = createSignal("Diagnostic checklist passed. Power assembly re-seated.");
  const [workPerformed, setWorkPerformed] = createSignal("Replaced damaged thermal gasket and tested pump pressure.");
  const [npsRating, setNpsRating] = createSignal(9);
  const [feedback, setFeedback] = createSignal("Technician arrived on-time and fixed the issue quickly.");

  // Spare Part Requisition State
  const [spareProductId, setSpareProductId] = createSignal("");
  const [spareQuantity, setSpareQuantity] = createSignal(1);
  const [spareWarehouseId, setSpareWarehouseId] = createSignal("");

  const loadData = async () => {
    try {
      const [reqs, custs, prods, whs] = await Promise.all([
        api.getServiceRequests(),
        api.getCustomers(),
        api.getProducts(),
        api.getWarehouses(),
      ]);
      setRequests(reqs);
      setCustomers(custs);
      setProducts(prods);
      setWarehouses(whs);

      if (custs.length > 0 && !customerId()) setCustomerId(custs[0].id);
      if (prods.length > 0 && !spareProductId()) setSpareProductId(prods[0].id);
      if (whs.length > 0 && !spareWarehouseId()) setSpareWarehouseId(whs[0].id);
      if (reqs.length > 0 && !selectedTicket()) setSelectedTicket(reqs[0]);
    } catch (err: any) {
      console.error(err);
    }
  };

  onMount(loadData);

  const handleCreateTicket = async (e: Event) => {
    e.preventDefault();
    try {
      await api.createServiceRequest({
        ticket_number: ticketNo(),
        customer_id: customerId(),
        product_name: productName(),
        product_serial: productSerial(),
        priority: priority(),
        issue_description: issueDescription(),
      });
      setShowCreateModal(false);
      setTicketNo(`SR-${Date.now().toString().slice(-5)}`);
      setProductName("");
      setProductSerial("");
      setIssueDescription("");
      loadData();
    } catch (err: any) {
      alert("Failed to lodge complaint: " + err.message);
    }
  };

  const handleDispatch = async (ticketId: string) => {
    try {
      await api.dispatchTechnician(ticketId, "tech-bikash", "Bikash Shrestha");
      loadData();
    } catch (err: any) {
      alert("Dispatch failed: " + err.message);
    }
  };

  const handleStartWork = async (ticketId: string) => {
    try {
      await api.updateServiceStatus(ticketId, "IN_PROGRESS", "Technician on-site doing diagnosis");
      loadData();
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleRequestSpare = async (e: Event) => {
    e.preventDefault();
    const ticket = selectedTicket();
    if (!ticket) return;

    try {
      await api.requestSparePart({
        service_request_id: ticket.id,
        product_id: spareProductId(),
        quantity: Number(spareQuantity()),
        from_warehouse_id: spareWarehouseId(),
        requested_by: "Bikash Shrestha",
      });
      setShowSpareModal(false);
      alert("Spare part requisition submitted and deducted from godown stock!");
      loadData();
    } catch (err: any) {
      alert("Failed to request spare part: " + err.message);
    }
  };

  const handleSignOff = async (signatureSvg: string) => {
    const ticket = selectedTicket();
    if (!ticket) return;

    try {
      await api.signOffServiceReport({
        service_request_id: ticket.id,
        diagnosis: diagnosis(),
        work_performed: workPerformed(),
        customer_signature_svg: signatureSvg,
        customer_name_signed: ticket.customer_name || "Authorized Representative",
        customer_phone_signed: ticket.customer_phone || "98XXXXXXXX",
        nps_rating: Number(npsRating()),
        customer_feedback: feedback(),
        signed_at: new Date().toISOString(),
      });
      setShowSignModal(false);
      alert("Service Report successfully signed & closed!");
      loadData();
    } catch (err: any) {
      alert("Sign-off failed: " + err.message);
    }
  };

  const getPriorityBadge = (p: string) => {
    if (p === "Urgent" || p === "High") return "erp-badge-danger";
    if (p === "Medium") return "erp-badge-warning";
    return "erp-badge-neutral";
  };

  const getStatusBadge = (s: string) => {
    if (s === "CLOSED" || s === "RESOLVED") return "erp-badge-success";
    if (s === "IN_PROGRESS") return "erp-badge-info";
    if (s === "DISPATCHED") return "erp-badge-warning";
    return "erp-badge-neutral";
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1.25rem", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "flex-wrap": "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ "font-size": "18px", "font-weight": "700", "letter-spacing": "-0.01em" }}>
            Field Service Operations & AMC Tickets
          </h2>
          <p style={{ "font-size": "12.5px", color: "var(--erp-text-secondary)" }}>
            14-step technician field workflow: intake, dispatch, diagnostics, parts, and digital sign-off
          </p>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <button
            type="button"
            class="erp-btn erp-btn-secondary"
            onClick={loadData}
            title="Refresh Tickets"
          >
            <IconRefresh size={14} />
          </button>
          <button
            type="button"
            class="erp-btn erp-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <IconPlus size={14} />
            <span>+ Lodge Complaint Ticket</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div class="erp-kpi-grid">
        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Active Tickets</div>
          <div class="erp-kpi-value tabular-nums">{requests().length}</div>
          <div class="erp-kpi-subtext">Open service requests</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Assigned & Dispatched</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-primary)" }}>
            {requests().filter((r) => r.status === "DISPATCHED" || r.status === "IN_PROGRESS").length}
          </div>
          <div class="erp-kpi-subtext">Technicians on route or on-site</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Completed & Signed</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-success)" }}>
            {requests().filter((r) => r.status === "CLOSED" || r.status === "RESOLVED").length}
          </div>
          <div class="erp-kpi-subtext">With client digital signature</div>
        </div>

        <div class="erp-kpi-card">
          <div class="erp-kpi-label">Average Customer CSAT</div>
          <div class="erp-kpi-value tabular-nums" style={{ color: "var(--erp-warning)" }}>
            9.2 / 10
          </div>
          <div class="erp-kpi-subtext">NPS feedback score</div>
        </div>
      </div>

      {/* Master/Detail Layout (Adaptive for Android & Desktop) */}
      <div class="erp-service-master-detail">
        {/* Ticket List Pane */}
        <div class={`erp-card erp-service-list-pane ${selectedTicket() ? "mobile-hide" : ""}`} style={{ display: "flex", "flex-direction": "column" }}>
          <div class="erp-card-header">
            <div class="erp-card-title">Service Requests</div>
            <div class="erp-badge erp-badge-neutral">{requests().length}</div>
          </div>

          <div style={{ flex: 1, "overflow-y": "auto", padding: "0.5rem" }}>
            <For
              each={requests()}
              fallback={
                <div class="erp-empty-state">
                  <p>No complaints lodged. Click "+ Lodge Complaint Ticket" to create one.</p>
                </div>
              }
            >
              {(ticket) => {
                const isSelected = () => selectedTicket()?.id === ticket.id;
                return (
                  <div
                    onClick={() => setSelectedTicket(ticket)}
                    style={{
                      padding: "0.875rem",
                      "border-radius": "var(--erp-radius-sm)",
                      background: isSelected() ? "var(--erp-bg-card-hover)" : "transparent",
                      border: isSelected() ? "1px solid var(--erp-primary-border)" : "1px solid transparent",
                      cursor: "pointer",
                      "margin-bottom": "0.375rem",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "0.375rem" }}>
                      <span style={{ "font-weight": "700", "font-size": "13px", color: "var(--erp-primary)" }}>
                        {ticket.ticket_number}
                      </span>
                      <span class={`erp-badge ${getPriorityBadge(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </div>

                    <div style={{ "font-weight": "600", "font-size": "13px", color: "var(--erp-text-main)" }}>
                      {ticket.product_name}
                    </div>

                    <div style={{ "font-size": "12px", color: "var(--erp-text-secondary)", "margin-top": "0.125rem" }}>
                      {ticket.customer_name} ({ticket.customer_phone})
                    </div>

                    <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-top": "0.5rem" }}>
                      <span class={`erp-badge ${getStatusBadge(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span class="tabular-nums" style={{ "font-size": "11px", color: "var(--erp-text-muted)" }}>
                        {ticket.created_at.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Ticket Detail & Workflow Execution Pane */}
        <div class={`erp-card erp-service-detail-pane ${!selectedTicket() ? "mobile-hide" : ""}`} style={{ display: "flex", "flex-direction": "column" }}>
          <Show
            when={selectedTicket()}
            fallback={
              <div class="erp-empty-state" style={{ height: "100%" }}>
                <p>Select a service ticket from the list to view diagnostic details and execute workflow.</p>
              </div>
            }
          >
            {(ticket) => (
              <>
                {/* Mobile Back Button (Visible only on mobile screen) */}
                <div class="erp-service-mobile-back" style={{ display: "none" }}>
                  <button
                    type="button"
                    class="erp-btn erp-btn-secondary erp-btn-sm"
                    onClick={() => setSelectedTicket(null)}
                    style={{ "margin": "0.75rem 0.75rem 0", display: "inline-flex", "align-items": "center", gap: "0.25rem" }}
                  >
                    <span>← Back to Ticket List</span>
                  </button>
                </div>

                <div class="erp-card-header">
                  <div>
                    <div style={{ display: "flex", "align-items": "center", gap: "0.625rem", "flex-wrap": "wrap" }}>
                      <span class="erp-card-title">{ticket().ticket_number}</span>
                      <span class={`erp-badge ${getStatusBadge(ticket().status)}`}>{ticket().status}</span>
                      <span class={`erp-badge ${getPriorityBadge(ticket().priority)}`}>{ticket().priority} Priority</span>
                    </div>
                    <div class="erp-card-subtitle">
                      Lodged by {ticket().customer_name} • Serial #{ticket().product_serial || "N/A"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Show when={ticket().status === "OPEN"}>
                      <button
                        type="button"
                        class="erp-btn erp-btn-secondary"
                        onClick={() => handleDispatch(ticket().id)}
                      >
                        Dispatch Bikash (Tech)
                      </button>
                    </Show>

                    <Show when={ticket().status === "DISPATCHED"}>
                      <button
                        type="button"
                        class="erp-btn erp-btn-secondary"
                        onClick={() => handleStartWork(ticket().id)}
                      >
                        Start Diagnostic Work
                      </button>
                    </Show>

                    <Show when={ticket().status === "IN_PROGRESS"}>
                      <button
                        type="button"
                        class="erp-btn erp-btn-secondary"
                        onClick={() => setShowSpareModal(true)}
                      >
                        + Request Spare Parts
                      </button>
                      <button
                        type="button"
                        class="erp-btn erp-btn-primary"
                        onClick={() => setShowSignModal(true)}
                      >
                        Sign-Off & Complete Ticket
                      </button>
                    </Show>
                  </div>
                </div>

                <div class="erp-card-body" style={{ flex: 1, "overflow-y": "auto", display: "flex", "flex-direction": "column", gap: "1.25rem" }}>
                  {/* Reported Problem */}
                  <div class="erp-card" style={{ background: "var(--erp-bg-subtle)", padding: "1rem" }}>
                    <div style={{ "font-weight": "600", "font-size": "12.5px", "margin-bottom": "0.375rem" }}>
                      Reported Issue & Symptoms
                    </div>
                    <div style={{ "font-size": "13px", color: "var(--erp-text-main)" }}>
                      {ticket().issue_description || "No description provided."}
                    </div>
                  </div>

                  {/* Technician & Assignment */}
                  <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                    <div class="erp-card" style={{ padding: "0.875rem", background: "var(--erp-bg-subtle)" }}>
                      <div class="erp-kpi-label">Assigned Technician</div>
                      <div style={{ "font-weight": "600", "font-size": "13.5px", "margin-top": "0.25rem" }}>
                        {ticket().technician_name || "Unassigned"}
                      </div>
                    </div>

                    <div class="erp-card" style={{ padding: "0.875rem", background: "var(--erp-bg-subtle)" }}>
                      <div class="erp-kpi-label">Customer Contact</div>
                      <div style={{ "font-weight": "600", "font-size": "13.5px", "margin-top": "0.25rem" }}>
                        {ticket().customer_phone || "N/A"}
                      </div>
                    </div>

                    <div class="erp-card" style={{ padding: "0.875rem", background: "var(--erp-bg-subtle)" }}>
                      <div class="erp-kpi-label">Machine Model</div>
                      <div style={{ "font-weight": "600", "font-size": "13.5px", "margin-top": "0.25rem" }}>
                        {ticket().product_name}
                      </div>
                    </div>
                  </div>

                  {/* 14-Step Checklist Preview */}
                  <div class="erp-card" style={{ padding: "1rem", background: "var(--erp-bg-subtle)" }}>
                    <div style={{ "font-weight": "600", "font-size": "12.5px", "margin-bottom": "0.75rem" }}>
                      Mandatory Site Inspection Checklist
                    </div>
                    <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.5rem" }}>
                      <div style={{ display: "flex", "align-items": "center", gap: "0.5rem", "font-size": "12.5px" }}>
                        <span style={{ color: "var(--erp-success)" }}>✓</span> Step 1: Safety & Earth Grounding Verified
                      </div>
                      <div style={{ display: "flex", "align-items": "center", gap: "0.5rem", "font-size": "12.5px" }}>
                        <span style={{ color: "var(--erp-success)" }}>✓</span> Step 2: Input AC Line Voltage (220V–240V)
                      </div>
                      <div style={{ display: "flex", "align-items": "center", gap: "0.5rem", "font-size": "12.5px" }}>
                        <span style={{ color: "var(--erp-success)" }}>✓</span> Step 3: Hydraulic Pressure Gauge Inspection
                      </div>
                      <div style={{ display: "flex", "align-items": "center", gap: "0.5rem", "font-size": "12.5px" }}>
                        <span style={{ color: "var(--erp-success)" }}>✓</span> Step 4: Lubrication Reservoir Checked
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Show>
        </div>
      </div>

      {/* Lodge Complaint Modal */}
      <Show when={showCreateModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "540px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Lodge Field Service Ticket</div>
                <div class="erp-card-subtitle">Customer complaint intake and equipment assignment</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Ticket Reference #</label>
                    <input
                      type="text"
                      required
                      class="erp-input tabular-nums"
                      value={ticketNo()}
                      onInput={(e) => setTicketNo(e.currentTarget.value)}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Priority</label>
                    <select
                      class="erp-select"
                      value={priority()}
                      onChange={(e) => setPriority(e.currentTarget.value)}
                    >
                      <option value="Urgent">Urgent (Breakdown)</option>
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low / Scheduled AMC</option>
                    </select>
                  </div>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Customer / Dealer</label>
                  <select
                    class="erp-select"
                    value={customerId()}
                    onChange={(e) => setCustomerId(e.currentTarget.value)}
                  >
                    <For each={customers()}>
                      {(c) => <option value={c.id}>{c.company_name} ({c.contact_person})</option>}
                    </For>
                  </select>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "1.5fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Equipment Model</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Combine Harvester Series 4"
                      class="erp-input"
                      value={productName()}
                      onInput={(e) => setProductName(e.currentTarget.value)}
                    />
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Serial Number</label>
                    <input
                      type="text"
                      placeholder="SN-2024-XXXX"
                      class="erp-input tabular-nums"
                      value={productSerial()}
                      onInput={(e) => setProductSerial(e.currentTarget.value)}
                    />
                  </div>
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Detailed Symptoms / Issue</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe failure symptoms, error codes, or leaking fluids..."
                    class="erp-textarea"
                    value={issueDescription()}
                    onInput={(e) => setIssueDescription(e.currentTarget.value)}
                  />
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Lodge Complaint
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Spare Parts Requisition Modal */}
      <Show when={showSpareModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "500px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Spare Part Requisition</div>
                <div class="erp-card-subtitle">Deducts spare stock directly from godown inventory</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowSpareModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestSpare}>
              <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
                <div class="erp-form-group">
                  <label class="erp-label">Source Godown</label>
                  <select
                    class="erp-select"
                    value={spareWarehouseId()}
                    onChange={(e) => setSpareWarehouseId(e.currentTarget.value)}
                  >
                    <For each={warehouses()}>
                      {(wh) => <option value={wh.id}>{wh.name} ({wh.location})</option>}
                    </For>
                  </select>
                </div>

                <div style={{ display: "grid", "grid-template-columns": "2fr 1fr", gap: "0.75rem" }}>
                  <div class="erp-form-group">
                    <label class="erp-label">Spare Part</label>
                    <select
                      class="erp-select"
                      value={spareProductId()}
                      onChange={(e) => setSpareProductId(e.currentTarget.value)}
                    >
                      <For each={products()}>
                        {(p) => <option value={p.id}>{p.code} - {p.name}</option>}
                      </For>
                    </select>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-label">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      class="erp-input tabular-nums"
                      value={spareQuantity()}
                      onInput={(e) => setSpareQuantity(Number(e.currentTarget.value))}
                    />
                  </div>
                </div>
              </div>

              <div class="erp-modal-footer">
                <button
                  type="button"
                  class="erp-btn erp-btn-secondary"
                  onClick={() => setShowSpareModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="erp-btn erp-btn-primary">
                  Approve & Issue Part
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Customer Electronic Sign-Off Modal */}
      <Show when={showSignModal()}>
        <div class="erp-modal-overlay">
          <div class="erp-modal" style={{ "max-width": "540px" }}>
            <div class="erp-modal-header">
              <div>
                <div class="erp-card-title">Customer Digital Sign-Off</div>
                <div class="erp-card-subtitle">Touch/mouse signature to close service ticket</div>
              </div>
              <button
                type="button"
                class="erp-btn erp-btn-ghost erp-btn-sm"
                onClick={() => setShowSignModal(false)}
              >
                ✕
              </button>
            </div>

            <div class="erp-modal-body" style={{ display: "flex", "flex-direction": "column", gap: "0.875rem" }}>
              <div class="erp-form-group">
                <label class="erp-label">Diagnostic Findings</label>
                <input
                  type="text"
                  required
                  class="erp-input"
                  value={diagnosis()}
                  onInput={(e) => setDiagnosis(e.currentTarget.value)}
                />
              </div>

              <div class="erp-form-group">
                <label class="erp-label">Corrective Work Completed</label>
                <input
                  type="text"
                  required
                  class="erp-input"
                  value={workPerformed()}
                  onInput={(e) => setWorkPerformed(e.currentTarget.value)}
                />
              </div>

              <div style={{ display: "grid", "grid-template-columns": "1fr 2fr", gap: "0.75rem" }}>
                <div class="erp-form-group">
                  <label class="erp-label">CSAT Score (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    class="erp-input tabular-nums"
                    value={npsRating()}
                    onInput={(e) => setNpsRating(Number(e.currentTarget.value))}
                  />
                </div>

                <div class="erp-form-group">
                  <label class="erp-label">Client Feedback</label>
                  <input
                    type="text"
                    class="erp-input"
                    value={feedback()}
                    onInput={(e) => setFeedback(e.currentTarget.value)}
                  />
                </div>
              </div>

              {/* Signature Pad */}
              <div class="erp-form-group">
                <label class="erp-label">Customer Representative Signature</label>
                <SignaturePad onSave={handleSignOff} />
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
