import { describe, expect, it, vi, beforeEach } from "vitest";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { ActionConfig } from "../../entities/actions/action/ActionConfig.js";
import {
  executeRoomCategoryAction,
  resolveDevicesForRoomCategory,
  resolveVacuumRoomIdsForStartCleaning,
  vacuumDeviceMapsToFloorPlanRoom,
} from "../roomCategoryActionExecutor.js";
import * as deviceMethodInvoke from "../deviceMethodInvoke.js";

function mockDevice(
  partial: Partial<Device> & {
    id: string;
    type: string;
    roomMapping?: Record<string, { id?: string; name?: string; segmentId?: string }>;
    buttons?: Record<string, { connectedToLight?: boolean; on?: boolean }>;
  }
): Device {
  const d = new Device({ isConnected: true, room: "room-a", ...partial });
  if (partial.roomMapping) {
    (d as Device & { roomMapping?: typeof partial.roomMapping }).roomMapping = partial.roomMapping;
  }
  if (partial.buttons) {
    (d as Device & { buttons?: typeof partial.buttons }).buttons = partial.buttons;
  }
  return d;
}

describe("roomCategoryActionExecutor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("vacuumDeviceMapsToFloorPlanRoom", () => {
    it("erkennt Grundriss-Raum ueber roomMapping", () => {
      const vacuum = mockDevice({
        id: "v1",
        type: DeviceType.VACUUM,
        roomMapping: { seg1: { id: "room-a", name: "Wohnzimmer", segmentId: "1" } },
      } as Partial<Device>);
      expect(vacuumDeviceMapsToFloorPlanRoom(vacuum, "room-a")).toBe(true);
      expect(vacuumDeviceMapsToFloorPlanRoom(vacuum, "room-b")).toBe(false);
    });
  });

  describe("resolveVacuumRoomIdsForStartCleaning", () => {
    it("mappt Grundriss-ID auf Sauger-Segment-Schluessel", () => {
      const vacuum = mockDevice({
        id: "v1",
        type: DeviceType.VACUUM,
        roomMapping: { seg_kitchen: { id: "fp-kitchen", name: "Kueche", segmentId: "9" } },
      } as Partial<Device>);
      expect(resolveVacuumRoomIdsForStartCleaning(vacuum, ["fp-kitchen"])).toEqual(["seg_kitchen"]);
    });
  });

  describe("resolveDevicesForRoomCategory", () => {
    const devices = [
      mockDevice({ id: "l1", type: DeviceType.LIGHT, room: "room-a" }),
      mockDevice({ id: "l2", type: DeviceType.LIGHT, room: "room-b" }),
      mockDevice({
        id: "s1",
        type: DeviceType.SWITCH,
        room: "room-a",
        buttons: { b1: { connectedToLight: true, on: false } },
      } as Partial<Device>),
      mockDevice({ id: "sp1", type: DeviceType.SPEAKER, room: "room-a" }),
      mockDevice({ id: "tv1", type: DeviceType.TV, room: "room-a" }),
      mockDevice({
        id: "v1",
        type: DeviceType.VACUUM,
        roomMapping: { seg1: { id: "room-a", name: "A", segmentId: "1" } },
      } as Partial<Device>),
    ];

    it("filtert Lichtgeraete pro Raum", () => {
      const lights = resolveDevicesForRoomCategory(devices, "room-a", "light");
      expect(lights.map((d) => d.id).sort()).toEqual(["l1", "s1"]);
    });

    it("liefert alle Lichtgeraete ohne roomId", () => {
      const lights = resolveDevicesForRoomCategory(devices, undefined, "light");
      expect(lights.map((d) => d.id).sort()).toEqual(["l1", "l2", "s1"]);
    });

    it("filtert Sauger per roomMapping", () => {
      const cleaners = resolveDevicesForRoomCategory(devices, "room-a", "cleaner");
      expect(cleaners.map((d) => d.id)).toEqual(["v1"]);
    });

    it("ignoriert nicht verbundene Geraete", () => {
      const offline = mockDevice({ id: "l3", type: DeviceType.LIGHT, room: "room-a", isConnected: false });
      const lights = resolveDevicesForRoomCategory([...devices, offline], "room-a", "light");
      expect(lights.find((d) => d.id === "l3")).toBeUndefined();
    });
  });

  describe("executeRoomCategoryAction", () => {
    it("ruft setOff auf allen Lichtern im Raum auf", async () => {
      const light = mockDevice({ id: "l1", type: DeviceType.LIGHT, room: "room-a" });
      light.setOn = vi.fn().mockResolvedValue(undefined);
      light.setOff = vi.fn().mockResolvedValue(undefined);

      const spy = vi.spyOn(deviceMethodInvoke, "invokeDeviceMethodOnDevice");

      const config = new ActionConfig({
        type: "room",
        roomId: "room-a",
        roomCategory: "light",
        roomCommand: "off",
      });

      const warnings = await executeRoomCategoryAction(config, new Map([[light.id, light]]));
      expect(warnings).toEqual([]);
      expect(spy).toHaveBeenCalledWith(light, "setOff", []);
    });

    it("ruft setOff auch fuer light-dimmer und Farblicht-Typen auf", async () => {
      const dimmer = mockDevice({ id: "d1", type: DeviceType.LIGHT_DIMMER, room: "room-a" });
      dimmer.setOff = vi.fn().mockResolvedValue(undefined);
      const ct = mockDevice({ id: "t1", type: DeviceType.LIGHT_DIMMER_TEMPERATURE, room: "room-a" });
      ct.setOff = vi.fn().mockResolvedValue(undefined);
      const rgb = mockDevice({ id: "c1", type: DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR, room: "room-a" });
      rgb.setOff = vi.fn().mockResolvedValue(undefined);

      const spy = vi.spyOn(deviceMethodInvoke, "invokeDeviceMethodOnDevice");

      const config = new ActionConfig({
        type: "room",
        roomId: "room-a",
        roomCategory: "light",
        roomCommand: "off",
      });

      const map = new Map([
        [dimmer.id, dimmer],
        [ct.id, ct],
        [rgb.id, rgb],
      ]);
      const warnings = await executeRoomCategoryAction(config, map);
      expect(warnings).toEqual([]);
      expect(spy).toHaveBeenCalledWith(dimmer, "setOff", []);
      expect(spy).toHaveBeenCalledWith(ct, "setOff", []);
      expect(spy).toHaveBeenCalledWith(rgb, "setOff", []);
    });

    it("startet Raumreinigung mit gemappten Segment-IDs", async () => {
      const vacuum = mockDevice({
        id: "v1",
        type: DeviceType.VACUUM,
        roomMapping: { seg1: { id: "room-a", name: "A", segmentId: "1" } },
      } as Partial<Device>);

      const spy = vi.spyOn(deviceMethodInvoke, "invokeDeviceMethodOnDevice");

      const config = new ActionConfig({
        type: "room",
        roomId: "room-a",
        roomCategory: "cleaner",
        roomCommand: "on",
      });

      await executeRoomCategoryAction(config, new Map([[vacuum.id, vacuum]]));
      expect(spy).toHaveBeenCalledWith(vacuum, "startCleaningRoom", [["seg1"]]);
    });

    it("warnt bei ungueltiger Kategorie", async () => {
      const config = new ActionConfig({
        type: "room",
        roomCategory: "invalid",
        roomCommand: "on",
      });
      const warnings = await executeRoomCategoryAction(config, new Map());
      expect(warnings.some((w) => w.includes("Ungueltige"))).toBe(true);
    });
  });
});
