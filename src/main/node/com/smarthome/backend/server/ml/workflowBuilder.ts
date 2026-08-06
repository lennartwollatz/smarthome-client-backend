import { randomUUID } from "node:crypto";
import { Node } from "../api/entities/actions/action/Node.js";
import { Workflow } from "../api/entities/actions/action/Workflow.js";
import { TriggerConfig } from "../api/entities/actions/action/TriggerConfig.js";
import { DeviceTrigger } from "../api/entities/actions/action/DeviceTrigger.js";
import { ActionConfig } from "../api/entities/actions/action/ActionConfig.js";
import { ActionStep } from "../api/entities/actions/action/ActionStep.js";
import { ConditionConfig } from "../api/entities/actions/action/ConditionConfig.js";
import { VariableConfig } from "../api/entities/actions/action/VariableConfig.js";
import { EventType } from "../events/event-types/EventType.js";
import type { CatalogDevice } from "./types.js";

let nodeCounter = 0;

function resetNodeCounter(): void {
  nodeCounter = 0;
}

function nextNodeId(prefix: string): string {
  nodeCounter += 1;
  return `${prefix}-${nodeCounter}-${randomUUID().slice(0, 8)}`;
}

function chainNodes(nodes: Node[]): Workflow {
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const node = nodes[i];
    const next = nodes[i + 1].nodeId;
    if (node.type === "condition") {
      if (!node.trueNodes?.length) node.trueNodes = [next];
    } else if (!node.nextNodes?.length) {
      node.nextNodes = [next];
    }
  }
  return new Workflow({ nodes, startNodeId: nodes[0]?.nodeId });
}

function deviceTriggerNode(
  deviceId: string,
  moduleId: string | undefined,
  eventType: EventType,
  nextId: string
): Node {
  return new Node({
    nodeId: nextNodeId("trigger"),
    type: "trigger",
    order: 0,
    name: "Trigger",
    triggerConfig: new TriggerConfig({
      type: "device",
      device: new DeviceTrigger({
        triggerDeviceId: deviceId,
        triggerModuleId: moduleId,
        triggerEvent: eventType,
      }),
    }),
    nextNodes: [nextId],
  });
}

function thermostatVarName(deviceId: string): string {
  return `ziel_${deviceId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function buildAllAbsentChain(presenceDevices: CatalogDevice[], firstActionId: string): Node[] {
  const nodes: Node[] = presenceDevices.map((pd) => {
    const nodeId = nextNodeId("cond");
    return new Node({
      nodeId,
      type: "condition",
      name: `${pd.name} abwesend`,
      conditionConfig: new ConditionConfig({
        source: "device",
        deviceId: pd.id,
        moduleId: pd.moduleId,
        property: "isAbsent",
      }),
      trueNodes: [],
    });
  });
  for (let i = 0; i < nodes.length; i += 1) {
    nodes[i].trueNodes = [i < nodes.length - 1 ? nodes[i + 1].nodeId : firstActionId];
  }
  return nodes;
}

/** Eco-Temperatur wenn alle abwesend; Bad optional ausgenommen. */
export function buildAwayHeatingWorkflow(
  presenceDevices: CatalogDevice[],
  thermostats: CatalogDevice[],
  excludeRoomNames: string[] = ["bad", "badezimmer", "bath"],
  ecoTemperature = 16
): Workflow | null {
  if (presenceDevices.length === 0 || thermostats.length === 0) return null;

  resetNodeCounter();
  const targetThermostats = thermostats.filter((t) => {
    const room = (t.room ?? "").toLowerCase();
    return !excludeRoomNames.some((ex) => room.includes(ex));
  });
  if (targetThermostats.length === 0) return null;

  const thermoNodes: Node[] = [];
  for (const thermo of targetThermostats) {
    const varName = thermostatVarName(thermo.id);
    const actId = nextNodeId("act");
    thermoNodes.push(
      new Node({
        nodeId: nextNodeId("var"),
        type: "variable",
        name: `Speichere ${thermo.name}`,
        variableConfig: new VariableConfig({
          name: varName,
          valueSource: "deviceField",
          deviceId: thermo.id,
          moduleId: thermo.moduleId,
          property: "temperatureGoal",
        }),
        nextNodes: [actId],
      }),
      new Node({
        nodeId: actId,
        type: "action",
        name: "Eco-Modus",
        actionConfig: new ActionConfig({
          type: "device",
          deviceId: thermo.id,
          moduleId: thermo.moduleId,
          steps: [new ActionStep({ action: "setTemperatureGoal", values: [ecoTemperature, true, true] })],
        }),
      })
    );
  }

  const firstThermoNodeId = thermoNodes[0].nodeId;
  const conditionNodes = buildAllAbsentChain(presenceDevices, firstThermoNodeId);
  const trigger = presenceDevices[0];
  const entryId = conditionNodes.length > 0 ? conditionNodes[0].nodeId : firstThermoNodeId;
  const triggerNode = deviceTriggerNode(trigger.id, trigger.moduleId, EventType.PRESENCE_AWAY, entryId);

  return chainNodes([triggerNode, ...conditionNodes, ...thermoNodes]);
}

/** Stellt gespeicherte Zieltemperatur wieder her (Ankunft). */
export function buildArrivalHeatingRestoreWorkflow(
  presenceDevices: CatalogDevice[],
  thermostats: CatalogDevice[]
): Workflow | null {
  if (presenceDevices.length === 0 || thermostats.length === 0) return null;

  resetNodeCounter();
  const actionNodes = thermostats.map((thermo) => {
    const varName = thermostatVarName(thermo.id);
    return new Node({
      nodeId: nextNodeId("act"),
      type: "action",
      name: `Restore ${thermo.name}`,
      actionConfig: new ActionConfig({
        type: "device",
        deviceId: thermo.id,
        moduleId: thermo.moduleId,
        steps: [
          new ActionStep({
            action: "setTemperatureGoal",
            values: [`{{var:${varName}}}`, true, true],
          }),
        ],
      }),
    });
  });

  const trigger = presenceDevices[0];
  const triggerNode = deviceTriggerNode(
    trigger.id,
    trigger.moduleId,
    EventType.PRESENCE_HOME,
    actionNodes[0].nodeId
  );

  return chainNodes([triggerNode, ...actionNodes]);
}

/** Auto nähert sich — Heizung hoch (Trigger: Standortänderung). */
export function buildCarApproachHeatingWorkflow(
  car: CatalogDevice,
  thermostats: CatalogDevice[],
  comfortTemperature = 20
): Workflow | null {
  if (thermostats.length === 0) return null;

  resetNodeCounter();
  const actionNodes = thermostats.map((thermo) =>
    new Node({
      nodeId: nextNodeId("act"),
      type: "action",
      name: `Vorheizen ${thermo.name}`,
      actionConfig: new ActionConfig({
        type: "device",
        deviceId: thermo.id,
        moduleId: thermo.moduleId,
        steps: [
          new ActionStep({
            action: "setTemperatureGoal",
            values: [comfortTemperature, true, true],
          }),
        ],
      }),
    })
  );

  const triggerNode = deviceTriggerNode(
    car.id,
    car.moduleId,
    EventType.CAR_LOCATION_CHANGED,
    actionNodes[0].nodeId
  );

  return chainNodes([triggerNode, ...actionNodes]);
}

/** Bewegung → Licht im selben Raum. */
export function buildMotionLightWorkflow(motion: CatalogDevice, light: CatalogDevice): Workflow | null {
  resetNodeCounter();
  const actionNode = new Node({
    nodeId: nextNodeId("act"),
    type: "action",
    name: "Licht an",
    actionConfig: new ActionConfig({
      type: "device",
      deviceId: light.id,
      moduleId: light.moduleId,
      steps: [new ActionStep({ action: "setOn", values: [true, true] })],
    }),
  });
  const triggerNode = deviceTriggerNode(
    motion.id,
    motion.moduleId,
    EventType.MOTION_DETECTED,
    actionNode.nodeId
  );
  return chainNodes([triggerNode, actionNode]);
}
