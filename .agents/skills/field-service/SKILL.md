---
name: field-service
description: >-
  Use this skill when implementing, extending, or testing the 14-step technician and
  field service operations module, including complaint intake, dispatching, site checklists,
  spare part approvals, godown stock deductions, and service report sign-offs.
---

# Technician & Field Service Operations Skill

This skill governs the implementation and workflows for Jubilant ERP's field service and maintenance module.

## The 14-Step Field Service Lifecycle

```
[Complaint Intake] ───────► [SR Ticket Created] ───────► [Assign Technician]
                                                               │
[Inspection & Diagnosis] ◄── [Technician On-Site] ◄── [Schedule Appointment]
          │
[Spare Parts Required?]
     ├── No  ──► [Labour Repair] ───┐
     └── Yes ──► [Spare Request]    │
                      │             │
                 [Approval]         │
                      │             │
              [Stock Deduction]     │
                      │             │
                      ▼             ▼
              [Execute Repair & QC Testing]
                      │
              [Generate PDF Service Report]
                      │
              [Customer Sign-off & NPS Rating]
                      │
              [Close Ticket & Warranty Update]
```

### Detailed Lifecycle Steps

1. **Complaint Intake**: Capture customer details, product serial number, priority (Low/Medium/High/Critical), and problem description.
2. **Ticket Registration**: Auto-generate unique Service Request number (e.g., `SR00045`).
3. **Technician Assignment**: Allocate based on territory and specialization.
4. **Appointment Scheduling**: Set planned visit date and time window.
5. **On-Site Status**: Technician marks status `On-Site` on arrival.
6. **Diagnostic Checklists**: Technician performs diagnosis using pre-configured checklist templates.
7. **Resolution Classification**: Determine if resolution is labour-only or requires replacement components.
8. **Spare Part Request**: If parts are needed, create an internal requisition detailing SKU, quantity, and source warehouse.
9. **Manager Approval**: Service Manager reviews and approves the spare part requisition.
10. **Stock Deduction**: Approved parts trigger automatic inventory reduction from the designated warehouse.
11. **Repair Execution**: Technician completes the physical replacement/repair.
12. **Quality Check (QC)**: Post-repair operational testing is recorded.
13. **Service Report Generation**: System compiles an official PDF Service Report capturing diagnosis, parts used, labour hours, and costs.
14. **Customer Sign-Off & Closure**: Customer signs on-screen (captured as signature blob/data URL), provides NPS rating (1–10), and the ticket transitions to `Closed`.
