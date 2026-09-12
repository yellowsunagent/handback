import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCommand,
  createState,
  migrateLegacy,
  validateState,
} from '../src/domain/state.ts';
import {
  LEGACY_STORAGE_KEY,
  RECOVERY_STORAGE_KEY,
  STORAGE_KEY,
  createRepository,
  type StorageAdapter,
} from '../src/storage/store.ts';

const profileId = 'profile_me';
const friendId = 'person_friend';
const toolId = 'tool_drill';
const loanId = 'loan_drill';

function readyState() {
  let state = createState(profileId);
  state = applyCommand(state, { type: 'profile', name: 'Alex' });
  state = applyCommand(state, {
    type: 'person',
    person: { id: friendId, name: 'Sam', note: 'neighbor' },
  });
  state = applyCommand(state, {
    type: 'tool',
    tool: {
      id: toolId,
      name: 'Cordless drill',
      ownerId: profileId,
      createdAt: '2026-09-11T12:00:00.000Z',
    },
  });
  return state;
}

test('profile names can change without changing stable ownership identity', () => {
  const initial = readyState();
  const renamed = applyCommand(initial, { type: 'profile', name: 'Alex Jordan' });

  assert.equal(renamed.profileId, profileId);
  assert.equal(renamed.people.find((person) => person.id === profileId)?.name, 'Alex Jordan');
  assert.equal(renamed.tools[0]?.ownerId, profileId);
});

test('same-name people remain separate records', () => {
  let state = readyState();
  state = applyCommand(state, {
    type: 'person',
    person: { id: 'person_other_sam', name: 'Sam' },
  });

  assert.equal(state.people.filter((person) => person.name === 'Sam').length, 2);
  assert.notEqual(state.people.find((person) => person.name === 'Sam')?.id, 'person_other_sam');
});

test('loan ownership follows the tool owner and one tool has one active loan', () => {
  let state = readyState();
  state = applyCommand(state, {
    type: 'loan',
    loan: {
      id: loanId,
      toolId,
      ownerId: profileId,
      borrowerId: friendId,
      startedOn: '2026-09-11',
      dueOn: '2026-09-18',
      reminder: true,
    },
  });

  assert.throws(
    () =>
      applyCommand(state, {
        type: 'loan',
        loan: {
          id: 'loan_duplicate',
          toolId,
          ownerId: profileId,
          borrowerId: friendId,
          startedOn: '2026-09-11',
          reminder: false,
        },
      }),
    /active loan/i,
  );
  assert.throws(
    () =>
      applyCommand(state, {
        type: 'loan',
        loan: {
          id: 'loan_wrong_owner',
          toolId,
          ownerId: friendId,
          borrowerId: profileId,
          startedOn: '2026-09-11',
          reminder: false,
        },
      }),
    /owner/i,
  );
});

test('return, undo, and delete preserve the active-loan invariant', () => {
  let state = readyState();
  state = applyCommand(state, {
    type: 'loan',
    loan: {
      id: loanId,
      toolId,
      ownerId: profileId,
      borrowerId: friendId,
      startedOn: '2026-09-11',
      reminder: true,
    },
  });
  state = applyCommand(state, { type: 'return', loanId, on: '2026-09-12' });
  assert.equal(state.loans[0]?.returnedOn, '2026-09-12');
  assert.equal(state.loans[0]?.reminder, true);

  state = applyCommand(state, { type: 'undo', loanId });
  assert.equal(state.loans[0]?.returnedOn, undefined);
  assert.equal(state.loans[0]?.reminder, true);
  state = applyCommand(state, { type: 'deleteLoan', loanId });
  assert.equal(state.loans.length, 0);
});

test('archiving a tool with an active loan is rejected and history can retain archives', () => {
  let state = readyState();
  state = applyCommand(state, {
    type: 'loan',
    loan: {
      id: loanId,
      toolId,
      ownerId: profileId,
      borrowerId: friendId,
      startedOn: '2026-09-11',
      reminder: false,
    },
  });
  assert.throws(
    () =>
      applyCommand(state, {
        type: 'tool',
        tool: { ...state.tools[0]!, archived: true },
      }),
    /active loan/i,
  );

  state = applyCommand(state, { type: 'return', loanId, on: '2026-09-12' });
  state = applyCommand(state, {
    type: 'tool',
    tool: { ...state.tools[0]!, archived: true },
  });
  assert.equal(state.tools[0]?.archived, true);
  assert.equal(state.loans[0]?.toolId, toolId);
});

test('validation rejects malformed references, identity, active duplicates, and dates', () => {
  const state = readyState();
  assert.throws(() => validateState({ ...state, profileId: '   ' }), /profile/i);
  assert.throws(
    () =>
      validateState({
        ...state,
        loans: [
          {
            id: loanId,
            toolId: 'missing_tool',
            ownerId: profileId,
            borrowerId: friendId,
            startedOn: '2026-02-30',
            reminder: false,
          },
        ],
      }),
    /tool|date/i,
  );
});

test('legacy migration converts unambiguous names and rejects conflicting ownership evidence', () => {
  const migrated = migrateLegacy(
    {
      version: 1,
      myName: 'Alex',
      tools: [
        {
          id: toolId,
          name: 'Cordless drill',
          ownerName: 'Alex',
          createdAt: '2026-09-11T12:00:00.000Z',
          currentLoanId: loanId,
        },
      ],
      loans: [
        {
          id: loanId,
          toolId,
          ownerName: 'Alex',
          borrowerName: 'Sam',
          startedAt: new Date(2026, 8, 11, 23, 30).toISOString(),
          dueAt: new Date(2026, 8, 18, 0, 30).toISOString(),
        },
      ],
    },
    profileId,
  );
  assert.equal(migrated.version, 2);
  assert.equal(migrated.profileId, profileId);
  assert.equal(migrated.people.find((person) => person.id === profileId)?.name, 'Alex');
  assert.equal(migrated.loans[0]?.startedOn, '2026-09-11');
  assert.equal(migrated.loans[0]?.dueOn, '2026-09-18');

  assert.throws(
    () =>
      migrateLegacy(
        {
          version: 1,
          myName: 'Alex',
          tools: [
            {
              id: toolId,
              name: 'Cordless drill',
              ownerName: 'Alex',
              createdAt: '2026-09-11T12:00:00.000Z',
            },
          ],
          loans: [
            {
              id: loanId,
              toolId,
              ownerName: 'Sam',
              borrowerName: 'Alex',
              startedAt: '2026-09-11T12:00:00.000Z',
            },
          ],
        },
        profileId,
      ),
    /owner|ambiguous/i,
  );
});

class MemoryStorage implements StorageAdapter {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];
  failWrites = false;
  writeDelay = 0;

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error('storage unavailable');
    if (this.writeDelay > 0) await new Promise((resolve) => setTimeout(resolve, this.writeDelay));
    this.writes.push(key);
    this.values.set(key, value);
  }
}

test('repository serializes concurrent updates into one valid snapshot', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, { profileId });
  await repository.dispatch({ type: 'profile', name: 'Alex' });
  storage.writeDelay = 2;

  await Promise.all([
    repository.dispatch({ type: 'person', person: { id: 'person_one', name: 'One' } }),
    repository.dispatch({ type: 'person', person: { id: 'person_two', name: 'Two' } }),
  ]);

  const state = await repository.loadState();
  assert.deepEqual(
    state.people.map((person) => person.id),
    [profileId, 'person_one', 'person_two'],
  );
  assert.equal(storage.values.has(STORAGE_KEY), true);
  assert.equal(storage.values.has(LEGACY_STORAGE_KEY), false);
});

test('failed persistence leaves the last committed snapshot available', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, { profileId });
  await repository.dispatch({ type: 'profile', name: 'Alex' });
  const before = storage.values.get(STORAGE_KEY);
  storage.failWrites = true;

  await assert.rejects(
    repository.dispatch({ type: 'person', person: { id: 'person_failed', name: 'Failed' } }),
    /storage unavailable/,
  );
  assert.equal(storage.values.get(STORAGE_KEY), before);

  storage.failWrites = false;
  const recovered = await repository.loadState();
  assert.equal(recovered.people.some((person) => person.id === 'person_failed'), false);
});

test('legacy repository migration retains the original snapshot and writes v2 separately', async () => {
  const storage = new MemoryStorage();
  const legacy = {
    version: 1,
    myName: 'Alex',
    tools: [],
    loans: [],
  };
  storage.values.set(LEGACY_STORAGE_KEY, JSON.stringify(legacy));
  const repository = createRepository(storage, { profileId });

  const migrated = await repository.loadState();
  assert.equal(migrated.version, 2);
  assert.equal(storage.values.get(LEGACY_STORAGE_KEY), JSON.stringify(legacy));
  assert.equal(JSON.parse(storage.values.get(STORAGE_KEY)!).version, 2);
});

test('ambiguous legacy data is rejected without replacing the retained source snapshot', async () => {
  const storage = new MemoryStorage();
  const legacy = {
    version: 1,
    myName: 'Alex',
    tools: [],
    loans: [
      {
        id: loanId,
        toolId: toolId,
        ownerName: 'Sam',
        borrowerName: 'Pat',
        startedAt: '2026-09-11T00:00:00.000Z',
      },
    ],
  };
  const raw = JSON.stringify(legacy);
  storage.values.set(LEGACY_STORAGE_KEY, raw);
  const repository = createRepository(storage, { profileId });

  await assert.rejects(repository.loadState(), /ambiguous|profile/i);
  assert.equal(storage.values.get(LEGACY_STORAGE_KEY), raw);
  assert.equal(storage.values.has(STORAGE_KEY), false);
});

test('replaceState preserves the previous raw snapshot before replacing it', async () => {
  const storage = new MemoryStorage();
  storage.values.set(STORAGE_KEY, '{"version":2,"bad":true}');
  const repository = createRepository(storage, { profileId });
  const replacement = createState(profileId);

  await repository.replaceState(replacement);
  assert.equal(storage.values.get(RECOVERY_STORAGE_KEY), '{"version":2,"bad":true}');
  assert.deepEqual(await repository.loadState(), replacement);
});

test('undo explains an ownership correction without changing completed history', () => {
  let state = readyState();
  state = applyCommand(state, { type: 'loan', loan: { id: loanId, toolId, ownerId: profileId, borrowerId: friendId, startedOn: '2026-09-11', reminder: false } });
  state = applyCommand(state, { type: 'return', loanId, on: '2026-09-12' });
  state = applyCommand(state, { type: 'tool', tool: { ...state.tools[0], ownerId: friendId } });
  assert.throws(() => applyCommand(state, { type: 'undo', loanId }), /owner has changed/i);
  assert.equal(state.loans[0].returnedOn, '2026-09-12');
});

test('legacy repeated names across independent records require disambiguation', () => {
  const tools = ['first', 'second'].map(id => ({ id, name: 'Drill', ownerName: 'Alex', createdAt: '2026-09-11T12:00:00.000Z' }));
  const loans = tools.map(tool => ({ id: `loan_${tool.id}`, toolId: tool.id, ownerName: 'Alex', borrowerName: 'Sam', startedAt: '2026-09-11T12:00:00.000Z' }));
  assert.throws(() => migrateLegacy({ version: 1, myName: 'Alex', tools, loans }, profileId), /ambiguous/);
  assert.throws(() => migrateLegacy({ version: 1, myName: 'Alex', tools: tools.map(tool => ({ ...tool, ownerName: 'Sam' })), loans: [] }, profileId), /ambiguous/);
});
