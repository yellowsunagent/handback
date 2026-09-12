import type { AppState, Command, Loan, Person, Tool } from '../types/models.ts';
import { isCalendarDay, localDay } from './dates.ts';

/** Errors raised when a state or command cannot be represented safely. */
export class StateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateError';
  }
}

type RecordValue = Record<string, unknown>;

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new StateError(`${label} must be an object`);
  }
  return value as RecordValue;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new StateError(`${label} must be text`);
  const trimmed = value.trim();
  if (!trimmed) throw new StateError(`${label} is required`);
  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) throw new StateError(`${label} contains control characters`);
  return trimmed;
}

export function validateIdentifier(value: unknown, label = 'identifier'): string {
  if (typeof value !== 'string') throw new StateError(`${label} must be text`);
  if (
    !/^[A-Za-z0-9_-]{1,256}$/.test(value) ||
    value === '__proto__' ||
    value === 'constructor' ||
    value === 'prototype'
  ) throw new StateError(`${label} is invalid`);
  return value;
}

const identifier = validateIdentifier;

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new StateError(`${label} must be text`);
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalBoolean(value: unknown, label: string, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new StateError(`${label} must be boolean`);
  return value;
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new StateError(`${label} must be boolean`);
  return value;
}

function photoReference(value: unknown, label: string): string | undefined {
  const uri = optionalText(value, label);
  if (uri === undefined) return undefined;
  if (/\p{Cc}/u.test(uri) || /^(?:https?:|data:|ftp:|javascript:)/i.test(uri)) {
    throw new StateError(`${label} must reference a local photo`);
  }
  if (/^handback-photo:/i.test(uri) || /^asset:/i.test(uri)) {
    const key = uri.slice(uri.indexOf(':') + 1);
    if (
      !/^[A-Za-z0-9._-]{1,256}$/.test(key) ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    ) throw new StateError(`${label} has an invalid local asset key`);
    return uri;
  }
  if (/^(?:file|content):\/\//i.test(uri)) return uri;
  throw new StateError(`${label} must reference a local photo`);
}

function activePerson(person: Person | undefined): boolean {
  return person !== undefined && person.archived !== true;
}

function calendarDay(value: unknown, label: string): string {
  if (!isCalendarDay(value)) throw new StateError(`${label} must be a calendar date (YYYY-MM-DD)`);
  return value;
}

function instant(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || !value.includes('T')) {
    throw new StateError(`${label} must be an ISO timestamp`);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new StateError(`${label} must be an ISO timestamp`);
  return new Date(time).toISOString();
}

function has(value: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizePerson(value: unknown, label = 'person'): Person {
  const source = record(value, label);
  const person: Person = {
    id: identifier(source.id, `${label}.id`),
    name: requiredText(source.name, `${label}.name`),
  };
  const note = optionalText(source.note, `${label}.note`);
  if (note !== undefined) person.note = note;
  const archived = optionalBoolean(source.archived, `${label}.archived`);
  if (archived) person.archived = true;
  return person;
}

function normalizeTool(value: unknown, label = 'tool'): Tool {
  const source = record(value, label);
  const tool: Tool = {
    id: identifier(source.id, `${label}.id`),
    name: requiredText(source.name, `${label}.name`),
    ownerId: identifier(source.ownerId, `${label}.ownerId`),
    createdAt: instant(source.createdAt, `${label}.createdAt`),
  };
  const notes = optionalText(source.notes, `${label}.notes`);
  if (notes !== undefined) tool.notes = notes;
  const photoUri = photoReference(source.photoUri, `${label}.photoUri`);
  if (photoUri !== undefined) tool.photoUri = photoUri;
  const archived = optionalBoolean(source.archived, `${label}.archived`);
  if (archived) tool.archived = true;
  return tool;
}

function normalizeLoan(value: unknown, label = 'loan'): Loan {
  const source = record(value, label);
  const loan: Loan = {
    id: identifier(source.id, `${label}.id`),
    toolId: identifier(source.toolId, `${label}.toolId`),
    ownerId: identifier(source.ownerId, `${label}.ownerId`),
    borrowerId: identifier(source.borrowerId, `${label}.borrowerId`),
    startedOn: calendarDay(source.startedOn, `${label}.startedOn`),
    reminder: requiredBoolean(source.reminder, `${label}.reminder`),
  };
  if (has(source, 'dueOn') && source.dueOn !== undefined) {
    loan.dueOn = calendarDay(source.dueOn, `${label}.dueOn`);
  }
  if (has(source, 'returnedOn') && source.returnedOn !== undefined) {
    loan.returnedOn = calendarDay(source.returnedOn, `${label}.returnedOn`);
  }
  if (loan.dueOn !== undefined && loan.dueOn < loan.startedOn) {
    throw new StateError(`${label}.dueOn cannot be before startedOn`);
  }
  if (loan.returnedOn !== undefined && loan.returnedOn < loan.startedOn) {
    throw new StateError(`${label}.returnedOn cannot be before startedOn`);
  }
  return loan;
}

function ensureUnique(items: Array<{ id: string }>, label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new StateError(`duplicate ${label} id: ${item.id}`);
    seen.add(item.id);
  }
}

/**
 * Validate and normalize a v2 snapshot. Unknown properties are removed, while
 * malformed required data, dangling references, and contradictory loan state
 * are rejected before callers can persist or render it.
 */
export function validateState(value: unknown): AppState {
  const source = record(value, 'state');
  if (source.version !== 2) throw new StateError('state version must be 2');
  const profileId = identifier(source.profileId, 'state.profileId');
  if (typeof source.setupComplete !== 'boolean') throw new StateError('state.setupComplete must be boolean');
  if (!Array.isArray(source.people)) throw new StateError('state.people must be an array');
  if (!Array.isArray(source.tools)) throw new StateError('state.tools must be an array');
  if (!Array.isArray(source.loans)) throw new StateError('state.loans must be an array');

  const people = source.people.map((person, index) => normalizePerson(person, `state.people[${index}]`));
  const tools = source.tools.map((tool, index) => normalizeTool(tool, `state.tools[${index}]`));
  const loans = source.loans.map((loan, index) => normalizeLoan(loan, `state.loans[${index}]`));

  ensureUnique(people, 'person');
  ensureUnique(tools, 'tool');
  ensureUnique(loans, 'loan');

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  const profile = peopleById.get(profileId);
  if (!source.setupComplete && (people.length > 0 || tools.length > 0 || loans.length > 0)) {
    throw new StateError('incomplete setup cannot contain people, tools, or loans');
  }
  if (source.setupComplete && !profile) {
    throw new StateError('setupComplete state must include the profile person');
  }
  if (!source.setupComplete && profile) {
    throw new StateError('incomplete setup cannot include a profile person');
  }
  if (profile?.archived) throw new StateError('the profile person cannot be archived');

  const activeToolIds = new Set<string>();
  for (const tool of tools) {
    if (!peopleById.has(tool.ownerId)) throw new StateError(`tool ${tool.id} references a missing owner`);
  }

  for (const loan of loans) {
    const tool = toolsById.get(loan.toolId);
    if (!tool) throw new StateError(`loan ${loan.id} references a missing tool`);
    if (!peopleById.has(loan.ownerId)) throw new StateError(`loan ${loan.id} references a missing owner`);
    if (!peopleById.has(loan.borrowerId)) throw new StateError(`loan ${loan.id} references a missing borrower`);
    if (loan.returnedOn === undefined && loan.ownerId !== tool.ownerId) {
      throw new StateError(`loan ${loan.id} owner must match its tool owner`);
    }
    if (loan.ownerId !== profileId && loan.borrowerId !== profileId) {
      throw new StateError(`loan ${loan.id} does not belong to this profile`);
    }
    if (loan.ownerId === loan.borrowerId) throw new StateError(`loan ${loan.id} owner and borrower must differ`);
    if (loan.returnedOn === undefined) {
      if (activeToolIds.has(loan.toolId)) throw new StateError(`tool ${loan.toolId} has more than one active loan`);
      activeToolIds.add(loan.toolId);
      if (tool.archived) throw new StateError(`tool ${tool.id} with an active loan cannot be archived`);
    }
  }

  return {
    version: 2,
    profileId,
    setupComplete: source.setupComplete,
    people,
    tools,
    loans,
  };
}

/** Create an empty v2 snapshot for a stable local profile identity. */
export function createState(profileId: string): AppState {
  const id = identifier(profileId, 'profileId');
  return {
    version: 2,
    profileId: id,
    setupComplete: false,
    people: [],
    tools: [],
    loans: [],
  };
}

function commandRecord(command: unknown): RecordValue {
  return record(command, 'command');
}

function commandType(command: unknown): string {
  const type = commandRecord(command).type;
  if (typeof type !== 'string') throw new StateError('command.type is required');
  return type;
}

function cloneState(state: AppState): AppState {
  return {
    version: 2,
    profileId: state.profileId,
    setupComplete: state.setupComplete,
    people: state.people.map((person) => ({ ...person })),
    tools: state.tools.map((tool) => ({ ...tool })),
    loans: state.loans.map((loan) => ({ ...loan })),
  };
}

/** Apply one domain command and return a new validated snapshot. */
export function applyCommand(state: AppState, command: Command): AppState {
  const current = validateState(state);
  const source = commandRecord(command);
  const type = commandType(command);
  const next = cloneState(current);

  switch (type) {
    case 'profile': {
      const name = requiredText(source.name, 'command.name');
      const index = next.people.findIndex((person) => person.id === next.profileId);
      if (index < 0) {
        next.people.push({ id: next.profileId, name });
      } else {
        next.people[index] = { ...next.people[index], name, archived: undefined };
        delete next.people[index].archived;
      }
      next.setupComplete = true;
      break;
    }
    case 'person': {
      const person = normalizePerson(source.person, 'command.person');
      if (person.id === next.profileId && person.archived) {
        throw new StateError('the profile person cannot be archived');
      }
      const index = next.people.findIndex((existing) => existing.id === person.id);
      if (index < 0) next.people.push(person);
      else next.people[index] = person;
      if (person.id === next.profileId) next.setupComplete = true;
      break;
    }
    case 'tool': {
      const tool = normalizeTool(source.tool, 'command.tool');
      const owner = next.people.find((person) => person.id === tool.ownerId);
      if (!owner) {
        throw new StateError(`tool ${tool.id} references a missing owner`);
      }
      const existing = next.tools.find((candidate) => candidate.id === tool.id);
      const relatedLoans = next.loans.filter((loan) => loan.toolId === tool.id);
      const activeRelatedLoan = relatedLoans.find((loan) => loan.returnedOn === undefined);
      if (existing && existing.ownerId !== tool.ownerId && activeRelatedLoan) {
        throw new StateError(`tool ${tool.id} owner cannot change while an active loan exists`);
      }
      if (!existing && owner.archived) throw new StateError(`archived person ${owner.id} cannot own a new tool`);
      if (tool.archived && relatedLoans.some((loan) => loan.returnedOn === undefined)) {
        throw new StateError(`tool ${tool.id} with an active loan cannot be archived`);
      }
      const index = next.tools.findIndex((candidate) => candidate.id === tool.id);
      if (index < 0) next.tools.push(tool);
      else next.tools[index] = tool;
      break;
    }
    case 'loan': {
      const loan = normalizeLoan(source.loan, 'command.loan');
      const tool = next.tools.find((candidate) => candidate.id === loan.toolId);
      if (!tool) throw new StateError(`loan ${loan.id} references a missing tool`);
      if (!next.people.some((person) => person.id === loan.ownerId)) {
        throw new StateError(`loan ${loan.id} references a missing owner`);
      }
      if (!next.people.some((person) => person.id === loan.borrowerId)) {
        throw new StateError(`loan ${loan.id} references a missing borrower`);
      }
      if (loan.ownerId !== tool.ownerId) throw new StateError(`loan ${loan.id} owner must match its tool owner`);
      if (loan.ownerId === loan.borrowerId) throw new StateError(`loan ${loan.id} owner and borrower must differ`);
      const index = next.loans.findIndex((candidate) => candidate.id === loan.id);
      const existing = index < 0 ? undefined : next.loans[index];
      const isActive = loan.returnedOn === undefined;
      if (tool.archived && isActive) throw new StateError(`archived tool ${tool.id} cannot be loaned`);
      if (isActive) {
        const owner = next.people.find((person) => person.id === loan.ownerId);
        const borrower = next.people.find((person) => person.id === loan.borrowerId);
        const ownerWasArchived = existing?.ownerId === loan.ownerId && existing.returnedOn === undefined;
        const borrowerWasArchived = existing?.borrowerId === loan.borrowerId && existing.returnedOn === undefined;
        if ((!activePerson(owner) && !ownerWasArchived) || (!activePerson(borrower) && !borrowerWasArchived)) {
          throw new StateError(`active loan ${loan.id} cannot use an archived person`);
        }
      }

      if (index < 0) {
        next.loans.push(loan);
      } else {
        const existing = next.loans[index];
        if (existing.toolId !== loan.toolId || existing.ownerId !== loan.ownerId) {
          throw new StateError(`loan ${loan.id} identity cannot change`);
        }
        if (
          existing.returnedOn !== undefined &&
          loan.returnedOn !== undefined &&
          existing.returnedOn !== loan.returnedOn
        ) {
          throw new StateError(`loan ${loan.id} already has a return date`);
        }
        // A QR copy omits return state. Preserve a locally recorded return when
        // a repeated save carries the same stable loan identifier.
        next.loans[index] = existing.returnedOn !== undefined && loan.returnedOn === undefined
          ? { ...loan, returnedOn: existing.returnedOn }
          : loan;
      }
      break;
    }
    case 'return': {
      const loanId = identifier(source.loanId, 'command.loanId');
      const on = calendarDay(source.on, 'command.on');
      const index = next.loans.findIndex((loan) => loan.id === loanId);
      if (index < 0) throw new StateError(`loan ${loanId} was not found`);
      const existing = next.loans[index];
      if (on < existing.startedOn) throw new StateError('return date cannot be before loan start date');
      if (existing.returnedOn !== undefined) {
        if (existing.returnedOn !== on) throw new StateError(`loan ${loanId} already has a return date`);
      } else {
        next.loans[index] = { ...existing, returnedOn: on };
      }
      break;
    }
    case 'undo': {
      const loanId = identifier(source.loanId, 'command.loanId');
      const index = next.loans.findIndex((loan) => loan.id === loanId);
      if (index < 0) throw new StateError(`loan ${loanId} was not found`);
      const existing = next.loans[index];
      if (existing.returnedOn === undefined) break;
      const tool = next.tools.find((candidate) => candidate.id === existing.toolId);
      if (tool?.archived) throw new StateError(`unarchive tool ${tool.id} before undoing its return`);
      if (tool && tool.ownerId !== existing.ownerId) {
        throw new StateError('This tool’s owner has changed. Correct its owner before undoing this return.');
      }
      if (next.loans.some((loan) => loan.id !== loanId && loan.toolId === existing.toolId && loan.returnedOn === undefined)) {
        throw new StateError(`tool ${existing.toolId} already has an active loan; return it before undoing`);
      }
      const restored = { ...existing };
      delete restored.returnedOn;
      next.loans[index] = restored;
      break;
    }
    case 'deleteLoan': {
      const loanId = identifier(source.loanId, 'command.loanId');
      const index = next.loans.findIndex((loan) => loan.id === loanId);
      if (index >= 0) next.loans.splice(index, 1);
      break;
    }
    default:
      throw new StateError(`unsupported command: ${type}`);
  }

  return validateState(next);
}

function legacyTimestamp(value: unknown, label: string): string {
  if (isCalendarDay(value)) return value;
  if (typeof value === 'string') {
    const originalDay = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      if (!isCalendarDay(originalDay) || !Number.isFinite(Date.parse(value))) {
        throw new StateError(`${label} must be a valid timestamp`);
      }
    }
  }
  // The baseline UI displayed these instants in the device's local timezone.
  // Keep that displayed calendar day instead of slicing a UTC conversion.
  return localDay(new Date(instant(value, label)));
}

function legacyName(value: unknown, label: string): string {
  return requiredText(value, label);
}

/**
 * Convert the baseline name-based snapshot to v2. A name is only used where
 * the old data provides enough evidence to do so; ownership contradictions and
 * a name appearing in both external owner and borrower roles fail loudly.
 */
export function migrateLegacy(value: unknown, profileId: string): AppState {
  const source = record(value, 'legacy state');
  if (source.version === 2) return validateState(source);
  if (source.version !== 1) {
    throw new StateError(`unsupported legacy state version: ${String(source.version)}`);
  }
  const id = identifier(profileId, 'profileId');
  const myName = legacyName(source.myName, 'legacy.myName');
  if (!Array.isArray(source.tools)) throw new StateError('legacy.tools must be an array');
  if (!Array.isArray(source.loans)) throw new StateError('legacy.loans must be an array');

  type LegacyTool = {
    id: string;
    name: string;
    ownerName: string;
    createdAt: string;
    photoUri?: string;
    currentLoanId?: string;
    archived?: boolean;
    notes?: string;
  };
  type LegacyLoan = {
    id: string;
    toolId: string;
    ownerName: string;
    borrowerName: string;
    startedOn: string;
    dueOn?: string;
    returnedOn?: string;
  };

  const legacyTools: LegacyTool[] = source.tools.map((value, index) => {
    const item = record(value, `legacy.tools[${index}]`);
    const result: LegacyTool = {
      id: identifier(item.id, `legacy.tools[${index}].id`),
      name: requiredText(item.name, `legacy.tools[${index}].name`),
      ownerName: legacyName(item.ownerName, `legacy.tools[${index}].ownerName`),
      createdAt: instant(item.createdAt, `legacy.tools[${index}].createdAt`),
    };
    const photoUri = optionalText(item.photoUri, `legacy.tools[${index}].photoUri`);
    if (photoUri !== undefined) result.photoUri = photoUri;
    const notes = optionalText(item.notes, `legacy.tools[${index}].notes`);
    if (notes !== undefined) result.notes = notes;
    if (has(item, 'currentLoanId') && item.currentLoanId !== undefined) {
      result.currentLoanId = identifier(item.currentLoanId, `legacy.tools[${index}].currentLoanId`);
    }
    if (item.archived !== undefined) result.archived = optionalBoolean(item.archived, `legacy.tools[${index}].archived`);
    return result;
  });
  const legacyLoans: LegacyLoan[] = source.loans.map((value, index) => {
    const item = record(value, `legacy.loans[${index}]`);
    const result: LegacyLoan = {
      id: identifier(item.id, `legacy.loans[${index}].id`),
      toolId: identifier(item.toolId, `legacy.loans[${index}].toolId`),
      ownerName: legacyName(item.ownerName, `legacy.loans[${index}].ownerName`),
      borrowerName: legacyName(item.borrowerName, `legacy.loans[${index}].borrowerName`),
      startedOn: legacyTimestamp(item.startedAt ?? item.startedOn, `legacy.loans[${index}].startedAt`),
    };
    if (has(item, 'dueAt') || has(item, 'dueOn')) {
      const due = item.dueAt ?? item.dueOn;
      if (due !== undefined) result.dueOn = legacyTimestamp(due, `legacy.loans[${index}].dueAt`);
    }
    if (has(item, 'returnedAt') || has(item, 'returnedOn')) {
      const returned = item.returnedAt ?? item.returnedOn;
      if (returned !== undefined) result.returnedOn = legacyTimestamp(returned, `legacy.loans[${index}].returnedAt`);
    }
    return result;
  });

  ensureUnique(legacyTools, 'legacy tool');
  ensureUnique(legacyLoans, 'legacy loan');
  const toolsById = new Map(legacyTools.map((tool) => [tool.id, tool]));
  const loansById = new Map(legacyLoans.map((loan) => [loan.id, loan]));
  const roles = new Map<string, Set<'owner' | 'borrower'>>();
  function noteRole(name: string, role: 'owner' | 'borrower'): void {
    const existing = roles.get(name) ?? new Set<'owner' | 'borrower'>();
    existing.add(role);
    roles.set(name, existing);
  }
  for (const tool of legacyTools) noteRole(tool.ownerName, 'owner');
  for (const loan of legacyLoans) {
    noteRole(loan.ownerName, 'owner');
    noteRole(loan.borrowerName, 'borrower');
    const ownerIsLocal = loan.ownerName === myName;
    const borrowerIsLocal = loan.borrowerName === myName;
    if (ownerIsLocal === borrowerIsLocal) {
      throw new StateError(`legacy loan ${loan.id} cannot be tied to this profile; migration is ambiguous`);
    }
    const tool = toolsById.get(loan.toolId);
    if (!tool) throw new StateError(`legacy loan ${loan.id} references a missing tool`);
    if (tool.ownerName !== loan.ownerName) {
      throw new StateError(`legacy loan ${loan.id} owner disagrees with its tool; migration is ambiguous`);
    }
  }
  for (const [name, nameRoles] of roles) {
    if (name !== myName && nameRoles.has('owner') && nameRoles.has('borrower')) {
      throw new StateError(`legacy person name ${name} appears as both owner and borrower; migration is ambiguous`);
    }
  }

  for (const tool of legacyTools) {
    if (tool.currentLoanId !== undefined) {
      const loan = loansById.get(tool.currentLoanId);
      if (!loan || loan.toolId !== tool.id || loan.returnedOn !== undefined) {
        throw new StateError(`legacy tool ${tool.id} has an invalid current loan reference`);
      }
    }
  }

  // Tool IDs tie loan owners to tools, but names cannot link separate people.
  // Require manual recovery when independent legacy references could be namesakes.
  const independentNames = new Set<string>();
  for (const name of [
    ...legacyTools.map(tool => tool.ownerName),
    ...legacyLoans.map(loan => loan.borrowerName),
  ]) {
    if (name === myName) continue;
    if (independentNames.has(name)) {
      throw new StateError(`legacy person name ${name} has repeated independent references; migration is ambiguous`);
    }
    independentNames.add(name);
  }

  const personIdByName = new Map<string, string>([[myName, id]]);
  const people: Person[] = [{ id, name: myName }];
  let personNumber = 1;
  function personId(name: string): string {
    const existing = personIdByName.get(name);
    if (existing) return existing;
    let next = `legacy_person_${personNumber++}`;
    while (next === id || people.some((person) => person.id === next)) {
      next = `legacy_person_${personNumber++}`;
    }
    personIdByName.set(name, next);
    people.push({ id: next, name });
    return next;
  }

  const tools: Tool[] = legacyTools.map((tool) => {
    const result: Tool = {
      id: tool.id,
      name: tool.name,
      ownerId: personId(tool.ownerName),
      createdAt: tool.createdAt,
    };
    if (tool.notes !== undefined) result.notes = tool.notes;
    if (tool.photoUri !== undefined) result.photoUri = tool.photoUri;
    if (tool.archived) result.archived = true;
    return result;
  });
  const loans: Loan[] = legacyLoans.map((loan) => ({
    id: loan.id,
    toolId: loan.toolId,
    ownerId: personId(loan.ownerName),
    borrowerId: personId(loan.borrowerName),
    startedOn: loan.startedOn,
    ...(loan.dueOn ? { dueOn: loan.dueOn } : {}),
    reminder: false,
    ...(loan.returnedOn ? { returnedOn: loan.returnedOn } : {}),
  }));

  return validateState({
    version: 2,
    profileId: id,
    setupComplete: true,
    people,
    tools,
    loans,
  });
}
