export const WORKFLOW_STATES = [
  "draft",
  "design_locked",
  "land_validated",
  "report_generated",
  "company_approved",
  "hiring_open",
  "execution_active",
  "closed",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

const TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  draft: ["design_locked"],
  design_locked: ["land_validated"],
  land_validated: ["report_generated"],
  report_generated: ["company_approved"],
  company_approved: ["hiring_open"],
  hiring_open: ["execution_active", "closed"],
  execution_active: ["closed"],
  closed: [],
};

export function isWorkflowState(value: unknown): value is WorkflowState {
  return typeof value === "string" && WORKFLOW_STATES.includes(value as WorkflowState);
}

export function canTransitionWorkflow(from: WorkflowState, to: WorkflowState) {
  return from === to || TRANSITIONS[from].includes(to);
}

export function assertWorkflowTransition(from: WorkflowState, to: WorkflowState) {
  if (!canTransitionWorkflow(from, to)) {
    throw new Error(`Invalid workflow transition: ${from} -> ${to}`);
  }
}

export function assertWorkflowPath(from: WorkflowState, path: WorkflowState[]) {
  let current = from;
  for (const next of path) {
    assertWorkflowTransition(current, next);
    current = next;
  }
}
