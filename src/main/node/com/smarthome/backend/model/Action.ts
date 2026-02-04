import { logger } from "../logger.js";
import { Workflow } from "./Workflow.js";
import { ActionConfig } from "./ActionConfig.js";
import { ConditionConfig } from "./ConditionConfig.js";
import { LoopConfig } from "./LoopConfig.js";
import { Node } from "./Node.js";
import { WaitConfig } from "./WaitConfig.js";
import { Scene } from "./Scene.js";
import { Device } from "./devices/Device.js";
import { ActionRunnable } from "../server/actions/actionRunnable.js";
import { DeviceListenerParams } from "./devices/helper/DeviceListenerParams.js";

type ActionRunnableMap = Map<string, ActionRunnable>;
type DeviceMap = Map<string, Device>;
type SceneMap = Map<string, Scene>;

export class Action {
  private static actionExecutor = {
    submit: (fn: () => void) => setImmediate(fn)
  };

  private isExecuting = false;

  actionId?: string;
  name?: string;
  triggerType?: string;
  workflow?: Workflow;
  createdAt?: string;
  updatedAt?: string;

  constructor(init?: Partial<Action>) {
    Object.assign(this, init);
  }

  getActionRunnable(devices: DeviceMap, scenes: SceneMap, actionRunnables: ActionRunnableMap) {
    return new ActionRunnable((value?: unknown) => {
      Action.actionExecutor.submit(() => {
        void this.executeWorkflow(devices, scenes, actionRunnables, value);
      });
    });
  }

  private async executeWorkflow(
    devices: DeviceMap,
    scenes: SceneMap,
    actionRunnables: ActionRunnableMap,
    triggerValue: unknown
  ) {
    if (this.isExecuting) {
      logger.warn(
        { actionId: this.actionId, name: this.name },
        "Action wird bereits ausgefuehrt - Trigger ignoriert"
      );
      return;
    }
    this.isExecuting = true;

    try {
      logger.info(
        { actionId: this.actionId, name: this.name, triggerValue },
        "ACTION START"
      );

      if (!this.workflow?.nodes || this.workflow.nodes.length === 0) {
        logger.warn({ actionId: this.actionId }, "Workflow fuer Action ist leer");
        return;
      }

      const startNode = this.resolveStartNode(this.workflow);
      if (!startNode) {
        logger.warn({ actionId: this.actionId }, "Kein Startknoten fuer Action gefunden");
        return;
      }

      await this.executeNode(startNode, devices, scenes, actionRunnables, triggerValue, new Map());
      logger.info({ actionId: this.actionId, name: this.name }, "ACTION ENDE");
    } finally {
      this.isExecuting = false;
      logger.debug({ actionId: this.actionId }, "Action ist wieder verfuegbar fuer neue Trigger");
    }
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

  private async executeNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    actionRunnables: ActionRunnableMap,
    triggerValue: unknown,
    context: Map<string, unknown>
  ) {
    if (!node) return;
    const nodeType = node.type;
    if (!nodeType) {
      logger.warn({ nodeId: node.nodeId }, "Node hat keinen Typ");
      return;
    }

    logger.info(
      { nodeId: node.nodeId, type: nodeType, actionId: this.actionId },
      "Node ausgefuehrt"
    );

    try {
      switch (nodeType) {
        case "trigger":
          await this.executeNextNodes(node, devices, scenes, actionRunnables, triggerValue, context);
          break;
        case "action":
          await this.executeActionNode(node, devices, scenes, actionRunnables, context);
          break;
        case "condition":
          await this.executeConditionNode(node, devices, scenes, actionRunnables, context);
          break;
        case "wait":
          await this.executeWaitNode(node, devices, scenes, actionRunnables, context);
          break;
        case "loop":
          await this.executeLoopNode(node, devices, scenes, actionRunnables, context);
          break;
        default:
          logger.warn({ nodeType, nodeId: node.nodeId }, "Unbekannter Node-Typ fuer Node");
          await this.executeNextNodes(node, devices, scenes, actionRunnables, triggerValue, context);
      }
    } catch (err) {
      logger.error({ err, nodeId: node.nodeId }, "Fehler beim Ausfuehren von Node");
    }
  }

  private async executeActionNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    actionRunnables: ActionRunnableMap,
    context: Map<string, unknown>
  ) {
    const actionConfig = node.actionConfig as ActionConfig | undefined;
    if (!actionConfig) {
      logger.warn({ nodeId: node.nodeId }, "Action-Node hat keine ActionConfig");
      await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      return;
    }

    const actionType = actionConfig.type;
    const actionName = actionConfig.action;
    const values = (actionConfig.values ?? []) as unknown[];

    if (actionType === "device") {
      const deviceId = actionConfig.deviceId;
      if (!deviceId) {
        logger.warn({ nodeId: node.nodeId }, "Device-Action in Node hat keine deviceId");
        await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
        return;
      }
      const device = devices.get(deviceId);
      if (!device) {
        logger.warn({ deviceId, nodeId: node.nodeId }, "Device nicht gefunden fuer Action-Node");
        await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
        return;
      }
      if (actionName) {
        this.invokeDeviceMethod(device, actionName, values);
      }
    } else if (actionType === "action") {
      if (actionName && actionRunnables.has(actionName)) {
        actionRunnables.get(actionName)?.run();
      } else {
        logger.warn({ actionName, nodeId: node.nodeId }, "Action nicht gefunden fuer Action-Node");
      }
    } else {
      logger.warn({ actionType, nodeId: node.nodeId }, "Unbekannter Action-Typ fuer Node");
    }

    await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
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
    actionRunnables: ActionRunnableMap,
    context: Map<string, unknown>
  ) {
    const conditionConfig = node.conditionConfig as ConditionConfig | undefined;
    if (!conditionConfig) {
      logger.warn({ nodeId: node.nodeId }, "Condition-Node hat keine ConditionConfig");
      await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      return;
    }
    const conditionResult = this.evaluateCondition(conditionConfig, devices);
    const nextNodes = conditionResult ? node.trueNodes : node.falseNodes;
    if (nextNodes && nextNodes.length) {
      for (const nextNodeId of nextNodes) {
        const nextNode = this.findNodeById(this.workflow?.nodes, nextNodeId);
        if (nextNode) {
          await this.executeNode(nextNode, devices, scenes, actionRunnables, null, context);
        }
      }
    }
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
    actionRunnables: ActionRunnableMap,
    context: Map<string, unknown>
  ) {
    const waitConfig = node.waitConfig as WaitConfig | undefined;
    if (!waitConfig) {
      await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      return;
    }

    if (waitConfig.type === "time") {
      const waitTime = waitConfig.waitTime ?? 0;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
      await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      return;
    }

    if (waitConfig.type === "trigger") {
      const deviceId = waitConfig.deviceId;
      const triggerEvent = waitConfig.triggerEvent;
      if (!deviceId || !triggerEvent) {
        await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
        return;
      }
      const device = devices.get(deviceId);
      if (!device) {
        await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
        return;
      }

      const listenerKey = `${this.actionId ?? "action"}-wait-${node.nodeId ?? "node"}`;
      const triggerValues = (waitConfig as any).triggerValues as unknown[] | undefined;
      const params = new DeviceListenerParams({
        key: listenerKey,
        name: triggerEvent,
        param1: triggerValues?.[0],
        param2: triggerValues?.[1]
      });

      let resolveWait: (() => void) | null = null;
      let executed = false;
      const donePromise = new Promise<void>(resolve => {
        resolveWait = resolve;
      });

      const waitListener = () => {
        if (executed) return;
        executed = true;
        device.removeListener(listenerKey, triggerEvent);
        resolveWait?.();
        void this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      };

      device.addListener(params, waitListener);
      device.triggerCheckListener?.(triggerEvent);

      const timeoutSeconds = waitConfig.timeout && waitConfig.timeout > 0 ? waitConfig.timeout : 86400;
      const timeoutPromise = new Promise<void>(resolve => {
        setTimeout(() => {
          device.removeListener(listenerKey, triggerEvent);
          resolve();
        }, timeoutSeconds * 1000);
      });

      await Promise.race([donePromise, timeoutPromise]);
      return;
    }

    await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
  }

  private async executeLoopNode(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    actionRunnables: ActionRunnableMap,
    context: Map<string, unknown>
  ) {
    const loopConfig = node.loopConfig as LoopConfig | undefined;
    if (!loopConfig) {
      await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      return;
    }
    const loopNodes = node.loopNodes ?? [];
    if (!loopNodes.length) {
      await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      return;
    }

    if (loopConfig.type === "for") {
      const count = loopConfig.count ?? 0;
      for (let i = 0; i < count; i += 1) {
        for (const loopNodeId of loopNodes) {
          const loopNode = this.findNodeById(this.workflow?.nodes, loopNodeId);
          if (loopNode) {
            await this.executeNode(loopNode, devices, scenes, actionRunnables, null, context);
          }
        }
      }
      await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      return;
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
            await this.executeNode(loopNode, devices, scenes, actionRunnables, null, context);
          }
        }
      }
      await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
      return;
    }

    await this.executeNextNodes(node, devices, scenes, actionRunnables, null, context);
  }

  private async executeNextNodes(
    node: Node,
    devices: DeviceMap,
    scenes: SceneMap,
    actionRunnables: ActionRunnableMap,
    triggerValue: unknown,
    context: Map<string, unknown>
  ) {
    const nextNodes = node.nextNodes ?? [];
    for (const nextNodeId of nextNodes) {
      const nextNode = this.findNodeById(this.workflow?.nodes, nextNodeId);
      if (nextNode) {
        await this.executeNode(nextNode, devices, scenes, actionRunnables, triggerValue, context);
      }
    }
  }

  getTriggerType() {
    return this.triggerType;
  }
}
