import type { AppState, Loan } from '../types/models.ts';

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Return the device-local calendar day represented by a Date. */
export function localDay(now: Date = new Date()): string {
  assertValidDate(now);
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part, index) => (index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0')))
    .join('-');
}

/** Whether a value is an actual ISO calendar day, without a time or timezone. */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = CALENDAR_DAY.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

/**
 * Human-readable due status for the UI. Calendar comparisons intentionally use
 * the local day so a due date never changes when a timestamp crosses a timezone.
 */
export function dueLabel(dueOn?: string, now: Date = new Date()): string {
  assertValidDate(now);
  if (dueOn === undefined) return 'No due date';
  if (!isCalendarDay(dueOn)) throw new TypeError('Due date must be a calendar day (YYYY-MM-DD)');

  const today = localDay(now);
  if (dueOn < today) return 'Overdue';
  if (dueOn === today) return 'Due today';
  if (dueOn === addDays(today, 1)) return 'Due tomorrow';
  return `Due ${dueOn}`;
}

export type ReminderPlan = {
  id: string;
  loanId: string;
  date: Date;
  title: string;
  body: string;
};

/**
 * Derive the complete desired local-notification set for the current device.
 * The returned Date is rebuilt on every call in the device's current timezone,
 * which lets callers reconcile schedules after a timezone change or app restart.
 */
export function reminderPlan(state: AppState, now: Date = new Date()): ReminderPlan[] {
  assertValidDate(now);
  const toolsById = new Map(state.tools.map((tool) => [tool.id, tool] as const));
  const peopleById = new Map(state.people.map((person) => [person.id, person] as const));
  const today = localDay(now);

  return state.loans
    .filter((loan) => loan.returnedOn === undefined && loan.reminder && loan.dueOn !== undefined)
    .filter((loan) => isCalendarDay(loan.dueOn))
    .map((loan) => toReminder(loan, toolsById, peopleById))
    .filter((item) => item.date.getTime() > now.getTime())
    .filter((item) => {
      // Keep this comparison explicit: it documents that a due-day reminder is
      // only omitted once its scheduled local time has elapsed.
      const dueOn = state.loans.find((loan) => loan.id === item.loanId)?.dueOn;
      return dueOn !== undefined && dueOn >= today;
    })
    .sort((left, right) => (left.loanId < right.loanId ? -1 : left.loanId > right.loanId ? 1 : 0));
}

function toReminder(
  loan: Loan,
  toolsById: Map<string, AppState['tools'][number]>,
  peopleById: Map<string, AppState['people'][number]>,
): ReminderPlan {
  // The filter above establishes this, while this guard keeps the helper total
  // if it is ever reused during a refactor.
  if (!loan.dueOn || !isCalendarDay(loan.dueOn)) throw new TypeError('Reminder due date must be a calendar day');
  const date = localNineAM(loan.dueOn);
  const toolName = toolsById.get(loan.toolId)?.name ?? 'Tool';
  const borrowerName = peopleById.get(loan.borrowerId)?.name ?? 'the borrower';
  return {
    id: `handback-reminder-${loan.id}`,
    loanId: loan.id,
    date,
    title: `Return ${toolName}`,
    body: `${toolName} is due back today (${borrowerName}).`,
  };
}

function localNineAM(day: string): Date {
  const match = CALENDAR_DAY.exec(day);
  if (!match) throw new TypeError('Expected a calendar day');
  const result = new Date(0);
  result.setHours(0, 0, 0, 0);
  result.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  result.setHours(9, 0, 0, 0);
  return result;
}

function addDays(day: string, amount: number): string {
  const match = CALENDAR_DAY.exec(day);
  if (!match) throw new TypeError('Expected a calendar day');
  const result = localNineAM(day);
  result.setDate(result.getDate() + amount);
  return localDay(result);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function assertValidDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError('Expected a valid Date');
}
