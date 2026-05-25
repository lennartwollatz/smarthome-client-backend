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

  it("setzt sofort den Startwert und endet exakt bei endBrightness", async () => {
    const device = new TestLightDimmer();
    const fadePromise = device.fadeBrightness(10, 100, 2);
    await fadePromise;

    expect(device.executed[0]).toBe(10);
    expect(device.brightness).toBe(10);

    await vi.advanceTimersByTimeAsync(2_000);

    expect(device.brightness).toBe(100);
    expect(device.executed[device.executed.length - 1]).toBe(100);
  });

  it("erzeugt monoton steigende Helligkeitsschritte", async () => {
    const device = new TestLightDimmer();
    await device.fadeBrightness(10, 100, 5);

    await vi.advanceTimersByTimeAsync(5_000);

    for (let i = 1; i < device.executed.length; i++) {
      expect(device.executed[i]).toBeGreaterThanOrEqual(device.executed[i - 1]);
    }
    expect(device.executed[0]).toBe(10);
    expect(device.executed[device.executed.length - 1]).toBe(100);
  });

  it("setzt bei duration <= 0 sofort den Endwert", async () => {
    const device = new TestLightDimmer();
    await device.fadeBrightness(0, 80, 0);

    expect(device.executed).toEqual([0, 80]);
    expect(device.brightness).toBe(80);
  });

  it("bricht einen laufenden Fade ab, wenn setBrightness aufgerufen wird", async () => {
    const device = new TestLightDimmer();
    await device.fadeBrightness(10, 100, 10);

    await vi.advanceTimersByTimeAsync(2_000);
    const stepsBefore = device.executed.length;
    await device.setBrightness(50, true, true);

    await vi.advanceTimersByTimeAsync(20_000);

    expect(device.brightness).toBe(50);
    expect(device.executed[device.executed.length - 1]).toBe(50);
    expect(device.executed.length).toBeLessThan(stepsBefore + 50);
  });

  it("clampt Eingaben auf 0-100", async () => {
    const device = new TestLightDimmer();
    await device.fadeBrightness(-50, 200, 1);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(device.executed[0]).toBe(0);
    expect(device.executed[device.executed.length - 1]).toBe(100);
  });
});
