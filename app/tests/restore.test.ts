import test from 'node:test';
import assert from 'node:assert/strict';
import { completeRestore } from '../src/services/restore.ts';
import { createState, applyCommand } from '../src/domain/state.ts';
import { createRepository } from '../src/storage/store.ts';

function profile(name: string) {
  return applyCommand(createState('local_profile'), { type: 'profile', name });
}

test('restore reports reminder failure separately from successfully replaced records', async () => {
  const data = new Map<string, string>();
  const repository = createRepository({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  await repository.replaceState(profile('Before'));
  const restored = await completeRestore(profile('From backup'), {
    replace: repository.replaceState,
    async reconcile() { throw new Error('Notifications unavailable'); },
    async discard() {},
  });
  assert.equal((await repository.loadState()).people[0].name, 'From backup');
  assert.equal(restored.reminderError, 'Notifications unavailable');
});

test('failed replacement keeps the old records and does not schedule restored reminders', async () => {
  const data = new Map<string, string>();
  let failWrites = false;
  let notified = false;
  const repository = createRepository({
    getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (failWrites) throw new Error('Disk full'); data.set(key, value); },
  });
  await repository.replaceState(profile('Before'));
  failWrites = true;
  await assert.rejects(completeRestore(profile('From backup'), {
    replace: repository.replaceState,
    async reconcile() { notified = true; },
    async discard() {},
  }), /Disk full/);
  assert.equal((await repository.loadState()).people[0].name, 'Before');
  assert.equal(notified, false);
});
