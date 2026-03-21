import { logger } from "../../../logger.js";
import { Workflow } from "./Workflow.js";
import { ConditionConfig } from "./ConditionConfig.js";
import { LoopConfig } from "./LoopConfig.js";
import { Node } from "./Node.js";
import { Scene } from "../scene/Scene.js";
import { Device } from "../../../model/devices/Device.js";
import { ActionRunnable } from "../runnable/ActionRunnable.js";
import { ActionRunnableEventBased, ActionRunnableEventBasedRunnable } from "../runnable/ActionRunnableEventBased.js";
import { TimeTrigger } from "./TimeTrigger.js";
import { ActionRunnableTimeBased, ActionRunnableTimeBasedRunnable } from "../runnable/ActionRunnableTimeBased.js";
import { DeviceTrigger } from "./DeviceTrigger.js";
import { ActionRunnableEnvironment } from "../runnable/ActionRunnableEnvironment.js";
import { ActionRunnableResponse } from "../runnable/ActionRunnableResponse.js";
import { ActionRunnableManualBased } from "../runnable/ActionRunnableManualBased.js";
import { EventManager } from "../../events/EventManager.js";

type DeviceMap = Map<string, Device>;
type SceneMap = Map<string, Scene>;
type ActionRunnableMap = Map<string, ActionRunnable>;

export type TriggerType = "manual" | "device" | "time";

export class Action {
  private isExecuting = false;

  actionId!: string;
  name!: string;
  triggerType!: TriggerType;
  workflow!: Workflow;
  isActive: boolean = true;
  isAiSuggested: boolean = false;
  aiDescription?: string;
  aiConfidence?: number;
  aiPatternType?: string;
  aiEvidenceCount?: number;
  createdAt!: string;
  updatedAt!: string;

  constructor(init?: Partial<Action>) {
    Object.assign(this, init);
  }

  public initActionRunnable(devices: DeviceMap, scenes: SceneMap, eventManager: EventManager): void {
    if( this.triggerType == "manual" ){
      const data:{runnable:ActionRunnableEventBasedRunnable} = this.createActionRunnableManualBasedRunnable(devices, scenes, eventManager);
      const runnable = new ActionRunnableManualBased(this.actionId, data.runnable);
      eventManager.addRunnable(runnable);
    } else if( this.triggerType == "device"){
      const data:{eventTrigger:DeviceTrigger | null, runnable:ActionRunnableEventBasedRunnable} = this.createActionRunnableEventBasedRunnable(devices, scenes, eventManager);
      if(!data.eventTrigger) return;
      const runnable = new ActionRunnableEventBased(this.actionId, this.actionId, data.runnable, data.eventTrigger);
      eventManager.addRunnable(runnable);
    } else {
      const data:{timeTrigger:TimeTrigger | null, runnable:ActionRunnableTimeBasedRunnable} = this.createActionRunnableTimeBasedRunnable(devices, scenes, eventManager);
      if(!data.timeTrigger) return;
      const runnable = new ActionRunnableTimeBased(this.actionId, data.runnable, data.timeTrigger);
      eventManager.addRunnable(runnable);
    }
  }

  private createActionRunnableManualBasedRunnable(devices: DeviceMap, scenes: SceneMap, eventManager: EventManager):{runnable:ActionRunnableEventBasedRunnable} {
    const runnable = async (environment:ActionRunnableEnvironment) => {
      return await this.executeWorkflow(devices, scenes, eventManager, environment);
    };
    return {runnable};
  }

  private createActionRunnableEventBasedRunnable(devices: DeviceMap, scenes: SceneMap, eventManager: EventManager):{eventTrigger:DeviceTrigger | null, runnable:ActionRunnableEventBasedRunnable} {
    const eventTrigger = this.getTriggerEvent();
    const runnable = async (environment:ActionRunnableEnvironment) => {
      return await this.executeWorkflow(devices, scenes, eventManager, environment);
    };
    return {eventTrigger, runnable};
  }

  private createActionRunnableTimeBasedRunnable(devices: DeviceMap, scenes: SceneMap, eventManager: EventManager):{timeTrigger:TimeTrigger | null, runnable:ActionRunnableTimeBasedRunnable} {
    const timeTrigger = this.getTriggerTime();
    const runnable = async () => {
      const environment = {environment:new Map<string, unknown>()};
      return await this.executeWorkflow(devices, scenes, eventManager, environment);
    };
    return {timeTrigger, runnable};
  }

  private getTriggerEvent():DeviceTrigger | null{
    const startNode = this.resolveStartNode(this.workflow);
    if( startNode.triggerConfig?.type == "device"){
      return startNode.triggerConfig?.device ?? null;
    } 
    return null;
  }

  private getTriggerTime():TimeTrigger | null{
    const startNode = this.resolveStartNode(this.workflow);
    if( startNode.triggerConfig?.type == "time"){
      return startNode.triggerConfig?.time ?? null;
    } 
    return null;
  }

  private async executeWorkflow(
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ): Promise<ActionRunnableResponse> {
    if (this.isExecuting) {
      return {
        success: true,
        warning: "Action wird bereits ausgefuehrt - Trigger ignoriert",
        environment: environment
      };
    }
    this.isExecuting = true;

    try {
      if (!this.workflow?.nodes || this.workflow.nodes.length <= 1) {
        return {
          success: true,
          warning: "Kein Startknoten fuer Action gefunden",
          environment: environment
        };
      }

      const startNode = this.resolveStartNode(this.workflow);
      if (!startNode) {
        return {
          success: false,
          error: "Kein Startknoten fuer Action gefunden, obwohl mehrere Nodes vorhanden sind",
          environment: environment
        };
      }

      const response = await this.executeNode(startNode, devices, scenes, eventManager, environment);
      this.isExecuting = false;
      return response;
    } catch (error) {
      this.isExecuting = false;
      return {
        success: false,
        error: error as string ?? "Unbekannter Fehler",
        environment: environment
      };
    }
  }

  private async executeNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ): Promise<ActionRunnableResponse> {
    if (!node) return {
      success: false,
      error: "Node ist leer",
      environment: environment
    };
    const nodeType = node.type;
    if (!nodeType) {
      return {
        success: false,
        error: `Node ${node.name} hat keinen Typ`,
        environment: environment
      };
    }

    try {
      switch (nodeType) {
        case "trigger":
          return await this.executeNextNodes(node, devices, scenes, eventManager, environment);
        case "action":
          return await this.executeActionNode(node, devices, scenes, eventManager, environment);
        case "condition":
          return await this.executeConditionNode(node, devices, scenes, eventManager, environment);
        case "wait":
          return await this.executeWaitNode(node, devices, scenes, eventManager, environment);
        case "loop":
          return await this.executeLoopNode(node, devices, scenes, eventManager, environment);
        default:
          return {
            success: false,
            error: `Node ${node.name} hat einen unbekannten Typ: ${nodeType}`,
            environment: environment
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error as string ?? "Unbekannter Fehler",
        environment: environment
      };
    }
  }

  private async executeActionNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse> {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const actionConfig = node.actionConfig;
    if (!actionConfig) {
      result = {success: result.success, warning: `Action-Node ${node.name} hat keine ActionConfig`, environment: result.environment};
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    const actionType = actionConfig.type;
    const actionName = actionConfig.action;
    const values = (actionConfig.values ?? []) as unknown[];

    if (actionType === "device") {
      const deviceId = actionConfig.deviceId;
      if (!deviceId) {
        result = {success: result.success, warning: `Device-Action in Node ${node.name} hat keine deviceId`, environment: result.environment};
        return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
      }
      const device = devices.get(deviceId);
      if (!device) {
        result = {success: result.success, warning: `Device nicht gefunden fuer Action-Node ${node.name}`, environment: result.environment};
        return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
      }
      if (actionName) {
        this.invokeDeviceMethod(device, actionName, values);
        //TODO: wenn aus der Funktion ein Promise zurückgegeben wird, soll dieser Wert in die Environment eingefügt werden.
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    } else if (actionType === "action") {
      if (actionName && eventManager.hasRunnable(actionName)) {
        const action = eventManager.getRunnable(actionName);
        if( action?.type == "manual") {
          result = await (action as ActionRunnableManualBased).run(result.environment);
        } 
        result = {success: result.success, warning: `Es können nur manuelle Aktionen aufgerufen werden. Action-Node ${node.name} hat einen anderen Action-Typ: ${action?.type}`, environment: result.environment};
      } else {
        result = {success: result.success, warning: `Action ${actionName} nicht gefunden fuer Action-Node ${node.name}`, environment: result.environment};
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    } else {
      return {success: false, error: `Unbekannter Action-Typ fuer Node ${node.name}`, environment: result.environment};
    }

  }

  private invokeDeviceMethod(device: Device, methodName: string, values: unknown[]) {
    try {
      const baseMethodName = methodName.includes("(")
        ? methodName.slice(0, methodName.indexOf("("))
        : methodName;
      const fn = (device as any)[baseMethodName];
      if (typeof fn !== "function") {
        logger.warn({ methodName: baseMethodName, deviceId: device.id }, "Methode nicht gefunden fuer Device");
        return;
      }

      if (!values || values.length === 0) {
        if (fn.length >= 1) {
          fn.call(device, true);
        } else {
          fn.call(device);
        }
        return;
      }

      if (values.length === 1) {
        const param = this.convertValue(values[0]);
        if (fn.length >= 2) {
          fn.call(device, param, true);
        } else {
          fn.call(device, param);
        }
        return;
      }

      if (values.length === 2) {
        const param1 = this.convertValue(values[0]);
        const param2 = this.convertValue(values[1]);
        if (fn.length >= 3) {
          fn.call(device, param1, param2, true);
        } else {
          fn.call(device, param1, param2);
        }
        return;
      }

      logger.warn({ methodName: baseMethodName }, "Methoden mit mehr als 2 Parametern werden nicht unterstuetzt");
    } catch (err) {
      logger.error(
        { err, methodName, deviceId: device.id },
        "Fehler beim Aufrufen der Methode auf Device"
      );
    }
  }

  private convertValue(value: unknown) {
    if (typeof value === "string") {
      if (value === "true") return true;
      if (value === "false") return false;
      if (!Number.isNaN(Number(value))) return Number(value);
    }
    return value;
  }

  private async executeConditionNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse>  {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const conditionConfig = node.conditionConfig;
    if (!conditionConfig) {
      result = {success: result.success, warning: `Condition-Node ${node.name} hat keine ConditionConfig`, environment: result.environment};
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }
    const conditionResult = this.evaluateCondition(conditionConfig, devices);
    const nextNodes = conditionResult ? node.trueNodes : node.falseNodes;
    if (nextNodes && nextNodes.length) {
      for (const nextNodeId of nextNodes) {
        const nextNode = this.findNodeById(this.workflow?.nodes, nextNodeId);
        if (nextNode) {
          result = await this.executeNode(nextNode, devices, scenes, eventManager, result.environment);
          if(!result.success) {
            return result;
          }
        }
      }
    }
    return result;
  }

  private evaluateCondition(conditionConfig: ConditionConfig, devices: DeviceMap) {
    const deviceId = conditionConfig.deviceId;
    const property = conditionConfig.property;
    const values = (conditionConfig.values ?? []) as unknown[];
    if (!deviceId || !property) return false;
    const device = devices.get(deviceId);
    if (!device) return false;
    const basePropertyName = property.includes("(")
      ? property.slice(0, property.indexOf("("))
      : property;
    const fn = (device as any)[basePropertyName];
    if (typeof fn !== "function") return false;

    if (!values || values.length === 0) {
      const result = fn.call(device);
      return Boolean(result);
    }
    if (values.length === 1) {
      const result = fn.call(device, this.convertValue(values[0]));
      return Boolean(result);
    }
    const result = fn.call(device, this.convertValue(values[0]), this.convertValue(values[1]));
    return Boolean(result);
  }

  private async executeWaitNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse>  {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const waitConfig = node.waitConfig;
    if (!waitConfig) {
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (waitConfig.type === "time") {
      const waitTime = waitConfig.waitTime ?? 0;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (waitConfig.type === "trigger") {
      const deviceId = waitConfig.deviceId;
      const triggerEvent = waitConfig.triggerEvent;
      const triggerValues = waitConfig.triggerValues;
      if (!deviceId || !triggerEvent) {
        return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
      }
      const device = devices.get(deviceId);
      if (!device) {
        return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
      }

      const subActionId = `${this.actionId ?? "action"}-wait-${node.nodeId ?? "node"}`;
      const eventTrigger = new DeviceTrigger({
        triggerDeviceId: deviceId,
        triggerModuleId: device.moduleId,
        triggerEvent: triggerEvent,
        triggerValues: triggerValues
      });

      const completionPromise = new Promise<Promise<ActionRunnableResponse>>((resolve) => {
        let timeout: NodeJS.Timeout | null = null;
        let completed = false;
        const complete = (res: Promise<ActionRunnableResponse>) => {
          if (completed) return;
          completed = true;
          eventManager.removeRunnable(actionRunnable);
          if (timeout) clearTimeout(timeout);
          resolve(res);
        };
        const runnable = async (env: ActionRunnableEnvironment) => {
          const res = this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
          complete(res);
          return await res;
        };
        const actionRunnable = new ActionRunnableEventBased(subActionId, this.actionId, runnable, eventTrigger);
        eventManager.addRunnable(actionRunnable);

        if (waitConfig.timeout && waitConfig.timeout > 0) {
          timeout = setTimeout(async () => {
            if (!completed) {
              const res = this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
              complete(res);
            }
          }, waitConfig.timeout * 1000);
        }
      });

      return await completionPromise;
    }

    return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
  }

  private async executeLoopNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse>  {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const loopConfig = node.loopConfig as LoopConfig | undefined;
    if (!loopConfig) {
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }
    const loopNodes = node.loopNodes ?? [];
    if (!loopNodes.length) {
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (loopConfig.type === "for") {
      const count = loopConfig.count ?? 0;
      for (let i = 0; i < count; i += 1) {
        for (const loopNodeId of loopNodes) {
          const loopNode = this.findNodeById(this.workflow?.nodes, loopNodeId);
          if (loopNode) {
            result = await this.executeNode(loopNode, devices, scenes, eventManager, result.environment);
            if(!result.success) {
              return result;
            }
          }
        }
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    if (loopConfig.type === "while") {
      const condition = loopConfig.condition;
      const maxIterations = loopConfig.maxIterations ?? 0;
      let iteration = 0;
      while (true) {
        iteration += 1;
        if (maxIterations > 0 && iteration > maxIterations) {
          break;
        }
        const conditionResult = condition ? this.evaluateCondition(condition, devices) : false;
        if (!conditionResult) break;
        for (const loopNodeId of loopNodes) {
          const loopNode = this.findNodeById(this.workflow?.nodes, loopNodeId);
          if (loopNode) {
            result = await this.executeNode(loopNode, devices, scenes, eventManager, result.environment);
            if(!result.success) {
              return result;
            }
          }
        }
      }
      return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
    }

    return await this.executeNextNodes(node, devices, scenes, eventManager, result.environment);
  }

  private async executeNextNodes(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    eventManager: EventManager,
    environment: ActionRunnableEnvironment
  ):Promise<ActionRunnableResponse>  {
    let result: ActionRunnableResponse = {success: true, environment: environment};
    const nextNodes = node.nextNodes ?? [];
    for (const nextNodeId of nextNodes) {
      const nextNode = this.findNodeById(this.workflow?.nodes, nextNodeId);
      if (nextNode) {
        result = await this.executeNode(nextNode, devices, scenes, eventManager, result.environment);
        if(!result.success) {
          return result;
        } 
      }
    }
    return result;
  }

  private resolveStartNode(workflow: Workflow) {
    const nodes = workflow.nodes ?? [];
    const startNodeId = workflow.startNodeId;
    if (startNodeId) {
      const node = this.findNodeById(nodes, startNodeId);
      if (node) return node;
    }
    const triggerNode = (workflow as any).triggerNode as Node | undefined;
    if (triggerNode) return triggerNode;
    const trigger = nodes.find(node => node.type === "trigger");
    if (trigger) return trigger;
    return nodes[0];
  }

  private findNodeById(nodes: Node[] | undefined, nodeId: string | undefined) {
    if (!nodes || !nodeId) return null;
    return nodes.find(node => node.nodeId === nodeId) ?? null;
  }

  getTriggerType() {
    return this.triggerType;
  }
}
