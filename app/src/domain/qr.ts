import { validateIdentifier, validateState } from './state.ts';
import type { AppState, Person, Tool } from '../types/models';
import { isCalendarDay } from './dates.ts';

const QR_VERSION = 2 as const;
const QR_KIND = 'handback-loan' as const;
export const MAX_QR_BYTES = 2_000;

/** The deliberately small, public data set exchanged by a HandBack QR code. */
export type LoanPayload = {
  version: typeof QR_VERSION;
  kind: typeof QR_KIND;
  loanId: string;
  toolId: string;
  toolName: string;
  ownerId: string;
  ownerName: string;
  borrowerId: string;
  borrowerName: string;
  startedOn: string;
  dueOn?: string;
};

const PAYLOAD_KEYS = [
  'version',
  'kind',
  'loanId',
  'toolId',
  'toolName',
  'ownerId',
  'ownerName',
  'borrowerId',
  'borrowerName',
  'startedOn',
  'dueOn',
] as const;

/** Parse and validate only the currently supported HandBack loan payload. */
export function parseLoanQR(raw: string): LoanPayload {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_QR_BYTES) {
    throw new TypeError('Invalid HandBack QR payload');
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TypeError('Invalid HandBack QR payload');
  }
  if (!isPlainObject(value)) throw new TypeError('Invalid HandBack QR payload');

  const keys = Object.keys(value);
  const expectedKeys: string[] = PAYLOAD_KEYS.filter((key) => key !== 'dueOn');
  if (Object.prototype.hasOwnProperty.call(value, 'dueOn')) expectedKeys.push('dueOn');
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    throw new TypeError('Unsupported HandBack QR fields');
  }

  if (value.version !== QR_VERSION || value.kind !== QR_KIND) throw new TypeError('Unsupported HandBack QR version');

  const payload: LoanPayload = {
    version: QR_VERSION,
    kind: QR_KIND,
    loanId: requiredId(value.loanId, 'loan ID'),
    toolId: requiredId(value.toolId, 'tool ID'),
    toolName: requiredText(value.toolName, 'tool name'),
    ownerId: requiredId(value.ownerId, 'owner ID'),
    ownerName: requiredText(value.ownerName, 'owner name'),
    borrowerId: requiredId(value.borrowerId, 'borrower ID'),
    borrowerName: requiredText(value.borrowerName, 'borrower name'),
    startedOn: requiredDay(value.startedOn, 'start date'),
  };

  if (payload.ownerId === payload.borrowerId) throw new TypeError('Owner and borrower must be different people');
  if (Object.prototype.hasOwnProperty.call(value, 'dueOn')) {
    payload.dueOn = requiredDay(value.dueOn, 'due date');
    if (payload.dueOn < payload.startedOn) throw new TypeError('Due date cannot precede the start date');
  }

  return payload;
}

/** Encode an already-saved loan. Only its owner may create a sharing payload. */
export function encodeLoanQR(state: AppState, loanId: string): string {
  const checked = validateState(state);
  const loan = checked.loans.find((candidate) => candidate.id === loanId);
  if (!loan) throw new Error('Loan not found');
  if (loan.ownerId !== checked.profileId) throw new Error('Only the tool owner can share this loan');

  const tool = checked.tools.find((candidate) => candidate.id === loan.toolId);
  const owner = checked.people.find((candidate) => candidate.id === loan.ownerId);
  const borrower = checked.people.find((candidate) => candidate.id === loan.borrowerId);
  if (!tool || !owner || !borrower) throw new Error('Loan references missing records');

  const raw = JSON.stringify({
    version: QR_VERSION,
    kind: QR_KIND,
    loanId: loan.id,
    toolId: tool.id,
    toolName: tool.name,
    ownerId: owner.id,
    ownerName: owner.name,
    borrowerId: borrower.id,
    borrowerName: borrower.name,
    startedOn: loan.startedOn,
    ...(loan.dueOn === undefined ? {} : { dueOn: loan.dueOn }),
  } satisfies LoanPayload);
  if (new TextEncoder().encode(raw).byteLength > MAX_QR_BYTES) {
    throw new Error('Loan details are too long to share as a QR code');
  }
  parseLoanQR(raw);
  return raw;
}

/**
 * Save a copy of a loan on another standalone device. This function never
 * mutates its input and returns the original state for a matching loan ID,
 * preserving local edits such as a recorded return.
 */
export function importLoanQR(state: AppState, payload: LoanPayload): AppState {
  const checked = validateState(state);
  const parsed = parseLoanQR(JSON.stringify(payload));

  const localOwner = checked.people.find((person) => person.id === parsed.ownerId);
  const localTool = checked.tools.find((tool) => tool.id === parsed.toolId);
  const localLoan = checked.loans.find((loan) => loan.id === parsed.loanId);

  if (localLoan) {
    if (localLoan.toolId !== parsed.toolId || localLoan.ownerId !== parsed.ownerId) {
      throw new Error('QR loan conflicts with the existing loan ID');
    }
    return checked;
  }

  if (parsed.ownerId === checked.profileId) {
    throw new Error('The owner cannot save their own QR as a borrower copy');
  }

  if (localTool && localTool.ownerId !== parsed.ownerId) throw new Error('QR tool owner conflicts with local tool');

  const activeForTool = checked.loans.find(
    (loan) => loan.toolId === parsed.toolId && loan.returnedOn === undefined,
  );
  if (activeForTool) throw new Error('This tool already has an active loan');

  // A local profile is the borrower on this phone. The foreign borrower ID in
  // the payload is informational and is never used to merge people across
  // devices; the owner ID remains stable so repeated scans identify the loan.
  const people: Person[] = [...checked.people];
  if (!localOwner) people.push({ id: parsed.ownerId, name: parsed.ownerName });

  const tools: Tool[] = [...checked.tools];
  if (!localTool) {
    tools.push({
      id: parsed.toolId,
      name: parsed.toolName,
      ownerId: parsed.ownerId,
      createdAt: `${parsed.startedOn}T00:00:00.000Z`,
    });
  }

  return validateState({
    ...checked,
    people,
    tools,
    loans: [
      ...checked.loans,
      {
        id: parsed.loanId,
        toolId: parsed.toolId,
        ownerId: parsed.ownerId,
        borrowerId: checked.profileId,
        startedOn: parsed.startedOn,
        ...(parsed.dueOn === undefined ? {} : { dueOn: parsed.dueOn }),
        reminder: false,
      },
    ],
  });
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.trim().length === 0) {
    throw new TypeError(`Invalid ${label}`);
  }
  if ([...value].some((character) => character < ' ' || character === '\u007f')) {
    throw new TypeError(`Invalid ${label}`);
  }
  return value;
}

function requiredId(value: unknown, label: string): string {
  return validateIdentifier(value, label);
}

function requiredDay(value: unknown, label: string): string {
  if (!isCalendarDay(value)) throw new TypeError(`Invalid ${label}`);
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
