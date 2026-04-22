export type ToolId = string;
export type LoanId = string;

export type Tool = {
  id: ToolId;
  name: string;
  photoUri?: string;
  ownerName: string; // "Me" display name (editable)
  createdAt: string; // ISO
  currentLoanId?: LoanId;
};

export type Loan = {
  id: LoanId;
  toolId: ToolId;
  ownerName: string;
  borrowerName: string;
  startedAt: string; // ISO
  dueAt?: string; // ISO
  returnedAt?: string; // ISO
};

export type AppState = {
  version: 1;
  myName: string;
  tools: Tool[];
  loans: Loan[];
};
