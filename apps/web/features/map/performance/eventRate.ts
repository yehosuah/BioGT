type TimerHandle = ReturnType<typeof setTimeout>;

type DebouncedFn<TArgs extends unknown[]> = ((...args: [...TArgs, number?]) => void) & {
  cancel: () => void;
};

type ThrottledFn<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  cancel: () => void;
};

export const createDebouncedCallback = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  defaultDelayMs: number
): DebouncedFn<TArgs> => {
  let timeoutHandle: TimerHandle | null = null;

  const debounced = ((...incomingArgs: [...TArgs, number?]) => {
    const maybeDelay = incomingArgs[incomingArgs.length - 1];
    const hasDelayOverride = typeof maybeDelay === "number";
    const args = (hasDelayOverride ? incomingArgs.slice(0, -1) : incomingArgs) as TArgs;
    const delayMs = hasDelayOverride ? (maybeDelay as number) : defaultDelayMs;

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    timeoutHandle = setTimeout(() => {
      timeoutHandle = null;
      callback(...args);
    }, delayMs);
  }) as DebouncedFn<TArgs>;

  debounced.cancel = () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  };

  return debounced;
};

export const createThrottledCallback = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  intervalMs: number
): ThrottledFn<TArgs> => {
  let timeoutHandle: TimerHandle | null = null;
  let lastInvocation = 0;
  let trailingArgs: TArgs | null = null;

  const invoke = (args: TArgs) => {
    lastInvocation = Date.now();
    callback(...args);
  };

  const throttled = ((...args: TArgs) => {
    const now = Date.now();
    const remainingMs = intervalMs - (now - lastInvocation);

    if (remainingMs <= 0) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      trailingArgs = null;
      invoke(args);
      return;
    }

    trailingArgs = args;
    if (!timeoutHandle) {
      timeoutHandle = setTimeout(() => {
        timeoutHandle = null;
        if (trailingArgs) {
          const nextArgs = trailingArgs;
          trailingArgs = null;
          invoke(nextArgs);
        }
      }, remainingMs);
    }
  }) as ThrottledFn<TArgs>;

  throttled.cancel = () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    trailingArgs = null;
  };

  return throttled;
};
