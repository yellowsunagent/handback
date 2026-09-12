export type Person = {
  id: string;
  name: string;
  note?: string;
  archived?: boolean;
};

export type Tool = {
  id: string;
  name: string;
  ownerId: string;
  notes?: string;
  photoUri?: string;
  archived?: boolean;
  createdAt: string;
};

export type Loan = {
  id: string;
  toolId: string;
  ownerId: string;
  borrowerId: string;
  // Calendar days (YYYY-MM-DD), never UTC instants.
  startedOn: string;
  dueOn?: string;
  reminder: boolean;
  returnedOn?: string;
};

export type AppState = {
  version: 2;
  profileId: string;
  setupComplete: boolean;
  people: Person[];
  tools: Tool[];
  loans: Loan[];
};

export type Command =
  | { type: 'profile'; name: string }
  | { type: 'person'; person: Person }
  | { type: 'tool'; tool: Tool }
  | { type: 'loan'; loan: Loan }
  | { type: 'return'; loanId: string; on: string }
  | { type: 'undo'; loanId: string }
  | { type: 'deleteLoan'; loanId: string };
