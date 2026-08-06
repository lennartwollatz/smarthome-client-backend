import { Action } from "../api/entities/actions/action/Action.js";
import { getDeviceMethodExact } from "../api/utils/deviceMethodInvoke.js";
import type { DeviceManager } from "../api/entities/devices/deviceManager.js";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/** Prüft, ob ein vorgeschlagener Action-Workflow technisch ausführbar ist. */
export function validateSuggestedAction(action: Action, deviceManager: DeviceManager): ValidationResult {
  const errors: string[] = [];
  const devices = deviceManager.getDevicesMap();
  const nodes = action.workflow?.nodes ?? [];
  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) {
    errors.push("Workflow ohne Trigger-Knoten");
  } else if (action.triggerType === "device") {
    const deviceId = trigger.triggerConfig?.device?.triggerDeviceId;
    const eventType = trigger.triggerConfig?.device?.triggerEvent;
    if (!deviceId) errors.push("Trigger ohne deviceId");
    if (!eventType) errors.push("Trigger ohne eventType");
    if (deviceId && !devices.has(deviceId)) errors.push(`Trigger-Gerät nicht gefunden: ${deviceId}`);
  }

  for (const node of nodes) {
    if (node.type === "action" && node.actionConfig?.type === "device") {
      const deviceId = node.actionConfig.deviceId;
      const device = deviceId ? devices.get(deviceId) : undefined;
      if (!device) {
        errors.push(`Action-Node "${node.name ?? node.nodeId}": Gerät ${deviceId} nicht gefunden`);
        continue;
      }
      for (const step of node.actionConfig.steps ?? []) {
        if (!step.action) continue;
        if (!getDeviceMethodExact(device, step.action)) {
          errors.push(`Gerät ${device.name}: Methode ${step.action} nicht verfügbar`);
        }
      }
    }
    if (node.type === "condition" && node.conditionConfig?.source === "device") {
      const deviceId = node.conditionConfig.deviceId;
      const property = node.conditionConfig.property;
      const device = deviceId ? devices.get(deviceId) : undefined;
      if (!device) {
        errors.push(`Condition-Node: Gerät ${deviceId} nicht gefunden`);
      } else if (property && !getDeviceMethodExact(device, property)) {
        errors.push(`Condition ${property} auf ${device.name} nicht verfügbar`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
