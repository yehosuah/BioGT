type LayerPriority = "critical" | "important" | "optional";

type LayerTask<TValue> = {
  id: string;
  priority: LayerPriority;
  run: () => Promise<TValue>;
  onResolved: (value: TValue) => void;
  onRejected: (error: unknown) => void;
};

type LayerTaskRunnerOptions = {
  signal?: AbortSignal;
};

type IdleCallbackHandle = number;
type IdleDeadline = { timeRemaining: () => number; didTimeout: boolean };

type IdleScheduler = (
  callback: (deadline: IdleDeadline) => void,
  options?: { timeout: number }
) => IdleCallbackHandle;

const scheduleIdleWork = (callback: () => void) => {
  const globalScope = globalThis as typeof globalThis & {
    requestIdleCallback?: IdleScheduler;
  };

  if (typeof globalScope.requestIdleCallback === "function") {
    return globalScope.requestIdleCallback(() => callback(), { timeout: 160 });
  }

  return globalThis.setTimeout(callback, 48);
};

const waitForIdle = () =>
  new Promise<void>((resolve) => {
    scheduleIdleWork(() => resolve());
  });

export const runLayerLoadQueue = async <TValue>(
  tasks: LayerTask<TValue>[],
  options: LayerTaskRunnerOptions = {}
) => {
  const groups: LayerPriority[] = ["critical", "important", "optional"];

  for (const priority of groups) {
    if (options.signal?.aborted) {
      return;
    }

    const queued = tasks.filter((task) => task.priority === priority);
    if (!queued.length) {
      continue;
    }

    if (priority !== "critical") {
      await waitForIdle();
    }

    await Promise.all(
      queued.map(async (task) => {
        if (options.signal?.aborted) {
          return;
        }

        try {
          const value = await task.run();
          if (!options.signal?.aborted) {
            task.onResolved(value);
          }
        } catch (error) {
          if (!options.signal?.aborted) {
            task.onRejected(error);
          }
        }
      })
    );
  }
};
