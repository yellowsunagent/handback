export type RootStackParamList = {
  Setup: undefined;
  ToolsList: undefined;
  Loans: { initialTab?: 'active' | 'history' } | undefined;
  People: undefined;
  AddTool: { toolId?: string; ownerId?: string } | undefined;
  ToolDetail: { toolId: string };
  StartLoan: { mode: 'lend' | 'borrow'; toolId?: string };
  EditLoan: { loanId: string };
  LoanDetail: { loanId: string };
  LoanQR: { loanId: string };
  ScanLoan: undefined;
  Settings: undefined;
};
