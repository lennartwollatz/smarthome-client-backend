import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceLightDimmer } from "../DeviceLightDimmer.js";

class TestLightDimmer extends DeviceLightDimmer {
  /** Aufgezeichnete Helligkeiten, die ans Geraet "geschickt" wurden. */
  public readonly executed: number[] = [];

  constructor() {
    super({ id: "test-light", name: "Test", isConnected: true });
  }

  protected async executeSetBrightness(brightness: number): Promise<void> {
    this.executed.push(brightness);
  }
}

describe("DeviceLightDimmer.fadeBrightness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("wartet, bis alle Fade-Schritte abgeschlossen sind", async () => {
    const device = new TestLightDimmer();
    let resolved = false;
    const fadePromise = device.fadeBrightness(10, 100, 2).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);
    expect(device.brightness).toBe(10);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1_500);
    await fadePromise;
    expect(resolved).toBe(true);
    expect(device.brightness).toBe(100);
    expect(device.executed[device.executed.length - 1]).toBe(100);
  });

  it("erzeugt monoton steigende Helligkeitsschritte", async () => {
    const device = new TestLightDimmer();
    const fadePromise = device.fadeBrightness(10, 100, 5);

    await vi.advanceTimersByTimeAsync(5_500);
    await fadePromise;

    for (let i = 1; i < device.executed.length; i++) {
      expect(device.executed[i]).toBeGreaterThanOrEqual(device.executed[i - 1]);
    }
    expect(device.executed[0]).toBe(10);
    expect(device.executed[device.executed.length - 1]).toBe(100);
  });

  it("setzt bei duration <= 0 sofort den Endwert und kehrt sofort zurueck", async () => {
    const device = new TestLightDimmer();
    await device.fadeBrightness(0, 80, 0);

    expect(device.executed).toEqual([0, 80]);
    expect(device.brightness).toBe(80);
  });

  it("bricht den Fade ab, wenn setBrightness aufgerufen wird und loest das Promise auf", async () => {
    const device = new TestLightDimmer();
    let resolved = false;
    const fadePromise = device.fadeBrightness(10, 100, 30).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(resolved).toBe(false);

    await device.setBrightness(50, true, true);
    await Promise.resolve();
    await fadePromise;

    expect(resolved).toBe(true);
    expect(device.brightness).toBe(50);

    const lengthAfterCancel = device.executed.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(device.executed.length).toBe(lengthAfterCancel);
  });

  it("ein zweiter fadeBrightness-Aufruf bricht den ersten ab", async () => {
    const device = new TestLightDimmer();
    let firstResolved = false;
    const firstFade = device.fadeBrightness(0, 100, 30).then(() => {
      firstResolved = true;
    });
    await vi.advanceTimersByTimeAsync(1_500);
    expect(firstResolved).toBe(false);

    const secondFade = device.fadeBrightness(60, 80, 2);
    await firstFade;
    expect(firstResolved).toBe(true);

    await vi.advanceTimersByTimeAsync(2_500);
    await secondFade;
    expect(device.brightness).toBe(80);
  });

  it("clampt Eingaben auf 0-100", async () => {
    const device = new TestLightDimmer();
    const fadePromise = device.fadeBrightness(-50, 200, 1);
    await vi.advanceTimersByTimeAsync(2_000);
    await fadePromise;

    expect(device.executed[0]).toBe(0);
    expect(device.executed[device.executed.length - 1]).toBe(100);
  });
});
