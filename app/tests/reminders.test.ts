import test from 'node:test';
import assert from 'node:assert/strict';
import { createReminderScheduler } from '../src/services/reminderScheduler.ts';

test('reconcile replaces obsolete reminders, keeps unrelated notifications, and never duplicates a loan', async () => {
  const pending = new Map<string, string>([['handback-old', 'old'], ['other', 'unrelated']]);
  const scheduler = createReminderScheduler({
    async list() { return [...pending.keys()]; },
    async cancel(id: string) { pending.delete(id); },
    async schedule(plan: { id: string; body: string }) { pending.set(plan.id, plan.body); },
  });
  await scheduler([{ id: 'handback-current', body: 'Drill due today' }]);
  await scheduler([{ id: 'handback-current', body: 'Drill due today' }]);
  assert.deepEqual([...pending], [['other', 'unrelated'], ['handback-current', 'Drill due today']]);
  await scheduler([]);
  assert.deepEqual([...pending], [['other', 'unrelated']]);
});

test('failed scheduling is reported and a later reconciliation restores the desired reminders', async () => {
  let fail = true;
  const pending = new Set<string>();
  const scheduler = createReminderScheduler({
    async list() { return [...pending]; },
    async cancel(id: string) { pending.delete(id); },
    async schedule(plan: { id: string }) {
      if (fail) throw new Error('Notifications unavailable');
      pending.add(plan.id);
    },
  });
  await assert.rejects(scheduler([{ id: 'handback-drill' }]), /unavailable/);
  fail = false;
  await Promise.all([scheduler([{ id: 'handback-drill' }]), scheduler([])]);
  assert.equal(pending.size, 0);
  await scheduler([{ id: 'handback-drill' }]);
  assert.deepEqual([...pending], ['handback-drill']);
});
