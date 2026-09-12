/** The device notification boundary; serialized reconciliation also recovers after failures. */
export function createReminderScheduler<T extends { id: string }>(device: {
  list(): Promise<string[]>;
  cancel(id: string): Promise<void>;
  schedule(plan: T): Promise<void>;
}) {
  let pending: Promise<void> = Promise.resolve();
  return (plans: T[]): Promise<void> => {
    const operation = pending.then(async () => {
      for (const id of await device.list()) {
        if (id.startsWith('handback-')) await device.cancel(id);
      }
      for (const plan of plans) await device.schedule(plan);
    });
    pending = operation.catch(() => undefined);
    return operation;
  };
}
