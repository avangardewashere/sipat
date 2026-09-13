/**
 * These run in jsdom, which (like many real browsers) has no AudioContext, no Notification and no
 * vibration. So the first job of these tests is proving that missing APIs never break the app.
 */

type AlertsModule = typeof import("./browser");

/** Fresh copy of the module per test, so its cached AudioContext doesn't leak between tests. */
function loadAlerts(): AlertsModule {
  let mod!: AlertsModule;
  jest.isolateModules(() => {
    mod = jest.requireActual("./browser");
  });
  return mod;
}

function installFakeNotification(permission: NotificationPermission, { throws = false } = {}) {
  const constructed: Array<{ title: string; options?: NotificationOptions }> = [];
  const FakeNotification = function (this: unknown, title: string, options?: NotificationOptions) {
    if (throws) throw new TypeError("Illegal constructor");
    constructed.push({ title, options });
  } as unknown as typeof Notification;
  Object.assign(FakeNotification, {
    permission,
    requestPermission: jest.fn(async () => "granted" as NotificationPermission),
  });
  Object.defineProperty(globalThis, "Notification", { value: FakeNotification, configurable: true, writable: true });
  return { constructed, FakeNotification };
}

afterEach(() => {
  // Remove anything a test installed.
  delete (globalThis as { Notification?: unknown }).Notification;
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
  delete (navigator as { vibrate?: unknown }).vibrate;
});

describe("when the browser supports none of it", () => {
  it("does nothing and never throws", async () => {
    const alerts = loadAlerts();

    expect(() => alerts.unlockSound()).not.toThrow();
    expect(() => alerts.chime()).not.toThrow();
    expect(() => alerts.vibrate()).not.toThrow();
    expect(alerts.notify("Title", "Body")).toBe(false);
    await expect(alerts.requestNotificationPermission()).resolves.toBe("unsupported");
  });
});

describe("notify", () => {
  it("shows a notification when permission is granted", () => {
    const { constructed } = installFakeNotification("granted");

    expect(loadAlerts().notify("Focus session done", "Time for a 5-minute break.")).toBe(true);
    expect(constructed).toEqual([
      { title: "Focus session done", options: { body: "Time for a 5-minute break.", tag: "sipat-phase" } },
    ]);
  });

  it("shows nothing without permission", () => {
    const { constructed } = installFakeNotification("default");

    expect(loadAlerts().notify("Title", "Body")).toBe(false);
    expect(constructed).toHaveLength(0);
  });

  it("returns false instead of crashing when the browser refuses (Android Chrome)", () => {
    installFakeNotification("granted", { throws: true });

    expect(loadAlerts().notify("Title", "Body")).toBe(false);
  });
});

describe("requestNotificationPermission", () => {
  it("asks the browser when the user hasn't decided yet", async () => {
    const { FakeNotification } = installFakeNotification("default");

    await expect(loadAlerts().requestNotificationPermission()).resolves.toBe("granted");
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("doesn't ask again once the user has blocked notifications", async () => {
    const { FakeNotification } = installFakeNotification("denied");

    await expect(loadAlerts().requestNotificationPermission()).resolves.toBe("denied");
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });
});

describe("vibrate", () => {
  it("uses the vibration API where it exists", () => {
    const vibrateFn = jest.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrateFn, configurable: true });

    loadAlerts().vibrate();

    expect(vibrateFn).toHaveBeenCalledWith([200, 100, 200]);
  });
});

describe("chime", () => {
  it("plays three notes through the Web Audio API", () => {
    const oscillators: Array<{ start: jest.Mock; frequency: { value: number } }> = [];
    const node = () => ({ connect: jest.fn((next: unknown) => next) });

    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = jest.fn(async () => {});
      createOscillator() {
        const osc = { ...node(), type: "", frequency: { value: 0 }, start: jest.fn(), stop: jest.fn() };
        oscillators.push(osc);
        return osc;
      }
      createGain() {
        return {
          ...node(),
          gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
        };
      }
    }
    Object.defineProperty(globalThis, "AudioContext", { value: FakeAudioContext, configurable: true, writable: true });

    loadAlerts().chime();

    expect(oscillators.map((o) => o.frequency.value)).toEqual([880, 660, 990]);
    oscillators.forEach((o) => expect(o.start).toHaveBeenCalledTimes(1));
  });
});
