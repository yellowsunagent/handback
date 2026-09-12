import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AppState } from '../src/types/models.ts';
import {
  encodeLoanQR,
  importLoanQR,
  parseLoanQR,
  type LoanPayload,
} from '../src/domain/qr.ts';
import { dueLabel, isCalendarDay, localDay, reminderPlan } from '../src/domain/dates.ts';
import {
  createBackup,
  MAX_ASSET_BYTES,
  materializeBackup,
  parseBackup,
  type BackupEnvelope,
} from '../src/domain/backup.ts';

const ownerId = 'person-owner';
const borrowerId = 'person-borrower';
const toolId = 'tool-drill';
const loanId = 'loan-drill';

function stateFor(profileId: string = ownerId): AppState {
  return {
    version: 2,
    profileId,
    setupComplete: true,
    people: [
      { id: ownerId, name: 'Jason' },
      { id: borrowerId, name: 'Sam' },
    ],
    tools: [
      {
        id: toolId,
        name: 'Cordless drill',
        ownerId,
        createdAt: '2026-09-10T12:00:00.000Z',
      },
    ],
    loans: [
      {
        id: loanId,
        toolId,
        ownerId,
        borrowerId,
        startedOn: '2026-09-10',
        dueOn: '2026-09-12',
        reminder: true,
      },
    ],
  };
}

function assertThrows(fn: () => unknown): void {
  assert.throws(fn);
}

test('QR round trip emits a strict v2 loan payload without private tool fields', () => {
  const raw = encodeLoanQR(stateFor(), loanId);
  const payload = parseLoanQR(raw);

  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'handback-loan');
  assert.deepEqual(payload, {
    version: 2,
    kind: 'handback-loan',
    loanId,
    toolId,
    toolName: 'Cordless drill',
    ownerId,
    ownerName: 'Jason',
    borrowerId,
    borrowerName: 'Sam',
    startedOn: '2026-09-10',
    dueOn: '2026-09-12',
  });

  assertThrows(() => parseLoanQR(JSON.stringify({ ...payload, notes: 'private' })));
  assertThrows(() => parseLoanQR(JSON.stringify({ ...payload, startedOn: '2026-09-10T00:00:00.000Z' })));
  const { dueOn: _dueOn, ...undated } = payload;
  assert.equal(parseLoanQR(JSON.stringify(undated)).dueOn, undefined);
  const undatedState = {
    ...stateFor(),
    loans: [{ ...stateFor().loans[0], dueOn: undefined }],
  };
  assert.equal(parseLoanQR(encodeLoanQR(undatedState, loanId)).dueOn, undefined);
  assertThrows(() => parseLoanQR(JSON.stringify({ ...payload, v: 2 })));
  assertThrows(() => encodeLoanQR(stateFor(borrowerId), loanId));
});

test('QR import creates local references, maps the borrower to the local profile, and is atomic', () => {
  const ownerBorrowerId = 'person-borrower-owner-side';
  const ownerState = {
    ...stateFor(),
    people: [
      { id: ownerId, name: 'Jason' },
      { id: ownerBorrowerId, name: 'Sam' },
    ],
    loans: [{ ...stateFor().loans[0], borrowerId: ownerBorrowerId }],
  };
  const payload = parseLoanQR(encodeLoanQR(ownerState, loanId));
  const localProfileId = 'person-borrower-local';
  const borrowerState: AppState = {
    ...stateFor(localProfileId),
    people: [
      { id: localProfileId, name: 'Sam' },
      { id: 'person-same-jason', name: 'Jason' },
    ],
    tools: [],
    loans: [],
  };

  const imported = importLoanQR(borrowerState, payload);
  assert.deepEqual(borrowerState.tools, []);
  assert.deepEqual(borrowerState.loans, []);
  assert.equal(imported.profileId, localProfileId);
  assert.deepEqual(imported.loans, [
    {
      id: loanId,
      toolId,
      ownerId,
      borrowerId: localProfileId,
      startedOn: '2026-09-10',
      dueOn: '2026-09-12',
      reminder: false,
    },
  ]);
  assert.deepEqual(imported.tools[0], {
    id: toolId,
    name: 'Cordless drill',
    ownerId,
    createdAt: '2026-09-10T00:00:00.000Z',
  });
  assert.deepEqual(imported.people, [
    { id: localProfileId, name: 'Sam' },
    { id: 'person-same-jason', name: 'Jason' },
    { id: ownerId, name: 'Jason' },
  ]);
  assert.equal(imported.people.some((person) => person.id === ownerBorrowerId), false);

  const returned = {
    ...imported,
    tools: [{ ...imported.tools[0], name: 'Locally renamed drill' }],
    loans: [{ ...imported.loans[0], returnedOn: '2026-09-13', reminder: true }],
  };
  assert.deepEqual(importLoanQR(returned, payload), returned);

  const conflicting = {
    ...borrowerState,
    people: [...borrowerState.people, { id: 'person-other-owner', name: 'Taylor' }],
    tools: [{ ...imported.tools[0], ownerId: 'person-other-owner' }],
  };
  assertThrows(() => importLoanQR(conflicting, payload));
  assertThrows(() => importLoanQR(imported, { ...payload, toolId: 'tool-other' }));
  assertThrows(() => importLoanQR(imported, { ...payload, ownerId: 'different-owner' }));
  assert.deepEqual(importLoanQR(ownerState, payload), ownerState);
  assertThrows(() => importLoanQR({ ...ownerState, loans: [] }, payload));
});

test('calendar dates use local calendar boundaries and leave undated loans without labels', () => {
  const beforeMidnight = new Date(2026, 8, 11, 23, 59, 59, 999);
  const afterMidnight = new Date(2026, 8, 12, 0, 0, 0, 0);
  assert.equal(localDay(beforeMidnight), '2026-09-11');
  assert.equal(localDay(afterMidnight), '2026-09-12');
  assert.equal(dueLabel(undefined, afterMidnight), 'No due date');
  assert.equal(dueLabel('2026-09-12', afterMidnight), 'Due today');
  assert.equal(dueLabel('2026-09-11', afterMidnight), 'Overdue');
  assert.equal(dueLabel('2026-09-13', afterMidnight), 'Due tomorrow');
  assert.equal(isCalendarDay('2024-02-29'), true);
  assert.equal(isCalendarDay('2023-02-29'), false);
  assert.equal(isCalendarDay('2026-09-12T00:00:00.000Z'), false);
});

test('reminder plan schedules each opted-in active loan once at local 9am and skips elapsed times', () => {
  const state = stateFor();
  const planned = reminderPlan(state, new Date(2026, 8, 11, 12, 0, 0, 0));
  assert.equal(planned.length, 1);
  assert.equal(planned[0].id, `handback-reminder-${loanId}`);
  assert.equal(planned[0].loanId, loanId);
  assert.equal(planned[0].date.getTime(), new Date(2026, 8, 12, 9, 0, 0, 0).getTime());

  assert.equal(reminderPlan(state, new Date(2026, 8, 12, 9, 0, 0, 0)).length, 0);
  assert.equal(reminderPlan(state, new Date(2026, 8, 13, 9, 0, 0, 0)).length, 0);
  assert.equal(
    reminderPlan(
      {
        ...state,
        loans: [{ ...state.loans[0], reminder: false }],
      },
      new Date(2026, 8, 11, 12, 0, 0, 0),
    ).length,
    0,
  );
});

test('backup export replaces photo URIs with asset keys and round trips photo bytes', async () => {
  const state = {
    ...stateFor(),
    tools: [{ ...stateFor().tools[0], photoUri: 'file:///photos/drill.jpg' }],
  };
  const raw = await createBackup(state, async (uri) => {
    assert.equal(uri, 'file:///photos/drill.jpg');
    return { base64: '/9j/AA==', mimeType: 'image/jpeg' };
  });
  const backup = parseBackup(raw);
  assert.equal(backup.version, 1);
  assert.equal(backup.kind, 'handback-backup');
  assert.equal(backup.state.tools[0].photoUri, 'asset:tool-drill');
  assert.deepEqual(backup.assets, {
    'tool-drill': { base64: '/9j/AA==', mimeType: 'image/jpeg' },
  });

  const written: string[] = [];
  const restored = await materializeBackup(raw, async (assetId, asset) => {
    written.push(`${assetId}:${asset.mimeType}:${asset.base64}`);
    return `handback-photo:${assetId}.jpg`;
  });
  assert.deepEqual(written, ['tool-drill:image/jpeg:/9j/AA==']);
  assert.equal(restored.tools[0].photoUri, 'handback-photo:tool-drill.jpg');
  assert.deepEqual(restored.loans, state.loans);
});

test('backup validation rejects invalid image assets and external or missing photo references', async () => {
  const state = stateFor();
  const valid: BackupEnvelope = {
    version: 1,
    kind: 'handback-backup',
    state: {
      ...state,
      tools: [{ ...state.tools[0], photoUri: 'asset:tool-drill' }],
    },
    assets: { 'tool-drill': { base64: '/9j/AA==', mimeType: 'image/jpeg' } },
  };

  assertThrows(() => parseBackup(JSON.stringify({ ...valid, state: { ...valid.state, tools: [{ ...valid.state.tools[0], photoUri: 'file:///outside.jpg' }] } })));
  assertThrows(() => parseBackup(JSON.stringify({ ...valid, assets: {} })));
  assertThrows(() => parseBackup(JSON.stringify({ ...valid, assets: { 'tool-drill': { base64: 'aGVsbG8=', mimeType: 'image/jpeg' } } })));
  assertThrows(() => parseBackup(JSON.stringify({ ...valid, assets: { 'tool-drill': { base64: '/9j/AA==', mimeType: 'image/png' } } })));
  assertThrows(() => parseBackup(JSON.stringify({ ...valid, assets: { 'tool-drill': { base64: '/9j/AA==', mimeType: 'image/gif' } } })));

  const before = JSON.stringify(valid);
  await assert.rejects(() => materializeBackup(JSON.stringify(valid), async () => {
    throw new Error('disk full');
  }));
  assert.equal(JSON.stringify(valid), before);
});

test('backup accepts a large valid image without regexp stack limits and enforces the byte cap', async () => {
  const state = {
    ...stateFor(),
    tools: [{ ...stateFor().tools[0], photoUri: 'file:///photos/large.jpg' }],
  };
  const image = Buffer.alloc(1024 * 1024, 0);
  image[0] = 0xff;
  image[1] = 0xd8;
  image[2] = 0xff;
  const base64 = image.toString('base64');
  const raw = await createBackup(state, async () => ({ base64, mimeType: 'image/jpeg' }));
  assert.equal(parseBackup(raw).assets[toolId].base64.length, base64.length);

  const oversized = Buffer.alloc(MAX_ASSET_BYTES + 1, 0);
  oversized[0] = 0xff;
  oversized[1] = 0xd8;
  oversized[2] = 0xff;
  await assert.rejects(() => createBackup(state, async () => ({
    base64: oversized.toString('base64'),
    mimeType: 'image/jpeg',
  })));
});


test('repeat QR keeps completed history after local tool ownership correction', () => {
  const source = stateFor();
  const payload = parseLoanQR(encodeLoanQR(source, loanId));
  const local = stateFor(borrowerId);
  local.loans[0].returnedOn = '2026-09-13';
  local.tools[0].ownerId = borrowerId;
  local.tools[0].notes = 'Ownership corrected on this phone';
  assert.deepEqual(importLoanQR(local, payload), local);
});

test('every encoded QR is accepted by the parser and unsafe identifiers are rejected', () => {
  const source = stateFor();
  source.tools[0].name = 'A'.repeat(300);
  assertThrows(() => encodeLoanQR(source, loanId));
  const payload = parseLoanQR(encodeLoanQR(stateFor(), loanId));
  assertThrows(() => parseLoanQR(JSON.stringify({ ...payload, toolId: '__proto__' })));
});
