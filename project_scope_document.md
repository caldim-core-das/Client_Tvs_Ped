# Project Scope Document: TVS PED Material Handling System

## 1. Project Overview
The **TVS PED Material Handling System** is a comprehensive web-based platform designed to digitize, track, and manage the end-to-end lifecycle of Material Handling (MH) equipment requests. The system streamlines the workflow from the initial request generation by employees to the final delivery and implementation by assigned vendors, ensuring full transparency, accountability, and standardized approval matrices.

## 2. Objectives
- **Digitize Workflows**: Eliminate manual and paper-based tracking of material handling asset requests.
- **Enforce Hierarchical Approvals**: Implement a strict, multi-tier validation and approval workflow (L1 Approver -> PED Engineer -> Designer -> Checker -> Final Approver).
- **Vendor & Asset Tracking**: Track vendor assignments, development milestones, lead times, and final asset delivery.
- **Real-Time Visibility**: Provide stakeholders with a centralized dashboard for KPIs, live statuses, and calendar-based tracking of delivery milestones.
- **Dynamic Role Management**: Allow administrative flexibility to create and manage custom roles without altering core system code.

## 3. In-Scope Features

### 3.1. User & Role Management
- Authentication and authorization framework.
- Dynamic custom role management (ability to add/edit custom roles via the UI).
- Core system roles mapping for workflow routing: `Requester`, `L1 Approver`, `PED Engineer`, `Designer`, `Checker`, `Final Approver`, `Admin`, and `Vendor`.

### 3.2. MH Request Workflow (State Machine)
- **Request Generation**: Requesters submit requirements for new or modified MH equipment.
- **L1 Validation**: L1 Approvers validate the feasibility of the request and assign it to a PED Engineer.
- **Design Phase**: PED Engineers assign a Designer. Designers upload CAD/design files.
- **Feedback Loop**: Checkers review designs. If requirements are not met, the request is reverted to the Designer or rejected back to the Requester with an automated email.
- **Final Approval**: Final Approvers sign off on the validated design.

### 3.3. Development & Vendor Tracking
- **MH Development Tracker**: Once approved, requests move to the development tracker to manage PR/PO release, vendor selection, sample production, and bulk lot readiness.
- **Vendor Management**: Maintain a registry of vendors, track their performance scores, and manage project milestones.

### 3.4. Dashboard & Analytics
- **KPI Metrics**: High-level overview of total requests, active requests, rejected requests, and implemented assets.
- **Live Status & Calendar**: A dynamic calendar view aggregating request creation dates, vendor delivery targets, and project milestones on a visual timeline.
- **Export Capabilities**: Export dashboard metrics to PDF, Excel, and PowerPoint.

### 3.5. Notifications
- Automated email notifications triggered by workflow state changes (e.g., notifying the L1 Approver upon new request submission, notifying the Requester upon rejection).

## 4. Out of Scope
- Direct integration with ERP systems (e.g., SAP) for automated PR/PO generation (unless explicitly defined in future phases).
- Financial accounting and payment processing for vendors.
- Mobile application development (the system is responsive web-based).

## 5. Technology Stack
- **Frontend**: React.js, Ant Design (UI Framework), Tailwind CSS, Vite.
- **Backend**: Node.js, Express.js.
- **Database**: MongoDB (Mongoose ODM).
- **Integrations**: Nodemailer (Email).

## 6. Success Criteria
- 100% digitization of the MH Request process.
- Reduction in approval turnaround times.
- Accurate reporting of vendor delivery timelines via the integrated calendar dashboard.
- Zero downtime during the deployment of dynamic role modifications.

## 7. Example Workflows (MH Request)

To help visualize the system in action, below are two realistic data scenarios tracing a Material Handling (MH) request from initiation through the approval matrix.

### Scenario 1: Fully Accepted Workflow (End-to-End Success)
- **Step 1 - Requester:** An assembly line worker submits a new MH request for a "Heavy-Duty Pallet Truck for Assembly Line B" to handle increased load capacity.
- **Step 2 - L1 Approver:** The shift manager (L1 Approver) reviews the request, confirms the operational need, approves it, and assigns it to a PED Engineer (e.g., John Doe).
- **Step 3 - PED Engineer:** John Doe evaluates the technical requirements and assigns the specific drafting task to a Designer (e.g., Jane Smith).
- **Step 4 - Designer:** Jane Smith creates the required 3D models and manufacturing drawings, uploads the CAD files into the system, and forwards the request for checking.
- **Step 5 - Checker:** The senior engineer (Checker) reviews Jane's design, confirms it meets all safety and load-bearing standards, and approves the design.
- **Step 6 - Final Approver:** The department head (Final Approver) reviews the complete package, provides final sign-off, and the request successfully transitions to the **Development & Vendor Tracking** phase for procurement.

### Scenario 2: Rejected Workflow (Feedback Loop / Rejection)
- **Step 1 - Requester:** A line supervisor submits a request for a "Custom Engine Lifter".
- **Step 2 - L1 Approver:** The L1 Approver validates the initial feasibility, approves the request, and assigns it to a PED Engineer (e.g., Alice).
- **Step 3 - PED Engineer:** Alice reviews the operational context and assigns the design work to a Designer (e.g., Bob).
- **Step 4 - Designer:** Bob uploads the preliminary CAD files and forwards the request to the Checker.
- **Step 5 - Checker:** The Checker reviews the design and identifies that the proposed engine lifter violates ergonomic safety compliance standards. 
- **Step 6 - Rejection Action:** The Checker **rejects** the design. The system automatically reverts the request status, and an automated email notification is dispatched to the Requester detailing the rejection reason (e.g., "Design fails ergonomic safety compliance"). The workflow halts until a revised or new request is submitted.
