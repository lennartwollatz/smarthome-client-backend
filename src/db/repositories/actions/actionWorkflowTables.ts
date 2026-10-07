import type { RowDataPacket } from "mysql2/promise";
import type { Node } from "../../../actions/action/Node.js";
import type { TriggerType } from "../../../actions/action/Action.js";
import { Workflow } from "../../../actions/action/Workflow.js";
import type { EventType } from "../../../events/event-types/EventType.js";
import type { SqlExecutor, SqlParam } from "../../database.js";
import { placeholders, toStringParam } from "../../sqlValues.js";
import {
  decodeValueList,
  encodeEventParameter,
  encodeValueList,
  type StoredValueType
} from "./workflowValueCodec.js";

const SQL_DELETE_WORKFLOW = `
  DELETE FROM action_nodes
  WHERE action_id = ?`;

const SQL_INSERT_NODE = `
  INSERT INTO action_nodes (
      action_id, node_id, sort_index, node_type, node_order, name, position_x, position_y
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

const SQL_INSERT_START_NODE = `
  INSERT INTO action_start_nodes (action_id, node_id)
  VALUES (?, ?)`;

const SQL_INSERT_LINK = `
  INSERT INTO action_node_links (action_id, node_id, link_type, sort_index, target_node_id)
  VALUES (?, ?, ?, ?, ?)`;

const SQL_SELECT_NODES = `
  SELECT
      n.action_id   AS actionId,
      n.node_id     AS nodeId,
      n.sort_index  AS sortIndex,
      n.node_type   AS nodeType,
      n.node_order  AS nodeOrder,
      n.name,
      n.position_x  AS positionX,
      n.position_y  AS positionY
  FROM action_nodes AS n`;

const SQL_SELECT_START_NODES = `
  SELECT action_id AS actionId, node_id AS nodeId
  FROM action_start_nodes`;

const SQL_SELECT_LINKS = `
  SELECT
      l.action_id       AS actionId,
      l.node_id         AS nodeId,
      l.link_type       AS linkType,
      l.sort_index      AS sortIndex,
      l.target_node_id  AS targetNodeId
  FROM action_node_links AS l`;

type NodeRow = RowDataPacket & {
  actionId: string;
  nodeId: string;
  sortIndex: number;
  nodeType: string;
  nodeOrder: number | null;
  name: string | null;
  positionX: number | null;
  positionY: number | null;
};

type LinkRow = RowDataPacket & {
  actionId: string;
  nodeId: string;
  linkType: "next" | "true" | "false" | "loop";
  sortIndex: number;
  targetNodeId: string;
};

type ValueRow = RowDataPacket & {
  actionId: string;
  nodeId: string;
  sortIndex: number;
  valueType: StoredValueType;
  valueText: string | null;
};

/** Ersetzt den gespeicherten Workflow einer Aktion vollständig (CASCADE löscht Kindtabellen). */
export async function saveWorkflow(
  tx: SqlExecutor,
  actionId: string,
  workflow: Workflow | undefined
): Promise<void> {
  await tx.execute(SQL_DELETE_WORKFLOW, [actionId]);
  const nodes = workflow?.nodes;
  if (!nodes?.length) return;

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    await tx.execute(SQL_INSERT_NODE, [
      actionId,
      node.nodeId,
      index,
      node.type,
      node.order ?? null,
      toStringParam(node.name),
      node.position?.x ?? null,
      node.position?.y ?? null
    ]);
    await saveNodeConfig(tx, actionId, node);
    await saveNodeLinks(tx, actionId, node);
  }

  if (workflow?.startNodeId) {
    await tx.execute(SQL_INSERT_START_NODE, [actionId, workflow.startNodeId]);
  }
}

export async function loadWorkflows(
  db: SqlExecutor,
  actionIds: readonly string[]
): Promise<Map<string, Workflow>> {
  const result = new Map<string, Workflow>();
  if (actionIds.length === 0) return result;

  const params: SqlParam[] = [...actionIds];
  const inClause = placeholders(actionIds);

  const nodeRows = await db.query<NodeRow>(
    `${SQL_SELECT_NODES}
  WHERE n.action_id IN (${inClause})
  ORDER BY n.action_id, n.sort_index`,
    params
  );

  const nodesByAction = groupByAction(nodeRows);
  if (nodeRows.length === 0) return result;

  const [
    startRows,
    linkRows,
    triggerRows,
    triggerDeviceRows,
    triggerDeviceValueRows,
    triggerTimeRows,
    triggerWeekdayRows,
    triggerVoiceRows,
    actionRows,
    actionValueRows,
    conditionRows,
    conditionValueRows,
    waitRows,
    waitValueRows,
    loopRows,
    loopConditionRows,
    loopConditionValueRows
  ] = await Promise.all([
    db.query<RowDataPacket & { actionId: string; nodeId: string }>(
      `${SQL_SELECT_START_NODES} WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<LinkRow>(`${SQL_SELECT_LINKS} WHERE action_id IN (${inClause}) ORDER BY action_id, node_id, link_type, sort_index`, params),
    db.query<RowDataPacket & { actionId: string; nodeId: string; triggerType: TriggerType }>(
      `SELECT action_id AS actionId, node_id AS nodeId, trigger_type AS triggerType FROM action_node_triggers WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; deviceId: string | null; moduleId: string | null; eventType: string | null }>(
      `SELECT action_id AS actionId, node_id AS nodeId, device_id AS deviceId, module_id AS moduleId, event_type AS eventType FROM action_node_trigger_devices WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<ValueRow>(
      `SELECT action_id AS actionId, node_id AS nodeId, sort_index AS sortIndex, value_type AS valueType, value_text AS valueText FROM action_node_trigger_device_values WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; frequency: string | null; timeOfDay: string | null; dayOfMonth: number | null; monthOfYear: number | null; dayOfYear: number | null }>(
      `SELECT action_id AS actionId, node_id AS nodeId, frequency, time_of_day AS timeOfDay, day_of_month AS dayOfMonth, month_of_year AS monthOfYear, day_of_year AS dayOfYear FROM action_node_trigger_times WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; weekday: number }>(
      `SELECT action_id AS actionId, node_id AS nodeId, weekday FROM action_node_trigger_time_weekdays WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; keyword: string | null; actionType: string | null; deviceId: string | null; pairingCode: string | null }>(
      `SELECT action_id AS actionId, node_id AS nodeId, keyword, action_type AS actionType, device_id AS deviceId, pairing_code AS pairingCode FROM action_node_trigger_voice_assistants WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; actionType: string | null; actionName: string | null; deviceId: string | null; moduleId: string | null; sceneId: string | null; calledActionId: string | null }>(
      `SELECT action_id AS actionId, node_id AS nodeId, action_type AS actionType, action_name AS actionName, device_id AS deviceId, module_id AS moduleId, scene_id AS sceneId, called_action_id AS calledActionId FROM action_node_actions WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<ValueRow>(
      `SELECT action_id AS actionId, node_id AS nodeId, sort_index AS sortIndex, value_type AS valueType, value_text AS valueText FROM action_node_action_values WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; deviceId: string | null; moduleId: string | null; propertyName: string | null }>(
      `SELECT action_id AS actionId, node_id AS nodeId, device_id AS deviceId, module_id AS moduleId, property_name AS propertyName FROM action_node_conditions WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<ValueRow>(
      `SELECT action_id AS actionId, node_id AS nodeId, sort_index AS sortIndex, value_type AS valueType, value_text AS valueText FROM action_node_condition_values WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; waitType: string | null; waitSeconds: number | null; deviceId: string | null; moduleId: string | null; eventType: string | null; timeoutSeconds: number | null }>(
      `SELECT action_id AS actionId, node_id AS nodeId, wait_type AS waitType, wait_seconds AS waitSeconds, device_id AS deviceId, module_id AS moduleId, event_type AS eventType, timeout_seconds AS timeoutSeconds FROM action_node_waits WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<ValueRow>(
      `SELECT action_id AS actionId, node_id AS nodeId, sort_index AS sortIndex, value_type AS valueType, value_text AS valueText FROM action_node_wait_values WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; loopType: string | null; iterationCount: number | null; maxIterations: number | null }>(
      `SELECT action_id AS actionId, node_id AS nodeId, loop_type AS loopType, iteration_count AS iterationCount, max_iterations AS maxIterations FROM action_node_loops WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<RowDataPacket & { actionId: string; nodeId: string; deviceId: string | null; moduleId: string | null; propertyName: string | null }>(
      `SELECT action_id AS actionId, node_id AS nodeId, device_id AS deviceId, module_id AS moduleId, property_name AS propertyName FROM action_node_loop_conditions WHERE action_id IN (${inClause})`,
      params
    ),
    db.query<ValueRow>(
      `SELECT action_id AS actionId, node_id AS nodeId, sort_index AS sortIndex, value_type AS valueType, value_text AS valueText FROM action_node_loop_condition_values WHERE action_id IN (${inClause})`,
      params
    )
  ]);

  const startByAction = new Map(startRows.map(row => [row.actionId, row.nodeId]));
  const linksByKey = groupLinks(linkRows);
  const triggerDeviceValues = groupValuesBySuffix(triggerDeviceValueRows, "triggerDevice");
  const actionValues = groupValuesBySuffix(actionValueRows, "action");
  const conditionValues = groupValuesBySuffix(conditionValueRows, "condition");
  const waitValues = groupValuesBySuffix(waitValueRows, "wait");
  const loopConditionValues = groupValuesBySuffix(loopConditionValueRows, "loopCondition");

  for (const [actionId, rows] of nodesByAction) {
    const nodes: Node[] = rows.map(row => {
      const key = nodeKey(actionId, row.nodeId);
      const node: Node = {
        nodeId: row.nodeId,
        type: row.nodeType,
        order: row.nodeOrder ?? undefined,
        name: row.name ?? undefined,
        position:
          row.positionX != null || row.positionY != null
            ? { x: row.positionX ?? undefined, y: row.positionY ?? undefined }
            : undefined,
        nextNodes: linksByKey.get(`${key}:next`),
        trueNodes: linksByKey.get(`${key}:true`),
        falseNodes: linksByKey.get(`${key}:false`),
        loopNodes: linksByKey.get(`${key}:loop`)
      };
      attachTriggerConfig(node, actionId, row.nodeId, triggerRows, triggerDeviceRows, triggerTimeRows, triggerWeekdayRows, triggerVoiceRows, triggerDeviceValues);
      attachActionConfig(node, actionId, row.nodeId, actionRows, actionValues);
      attachConditionConfig(node, actionId, row.nodeId, conditionRows, conditionValues);
      attachWaitConfig(node, actionId, row.nodeId, waitRows, waitValues);
      attachLoopConfig(node, actionId, row.nodeId, loopRows, loopConditionRows, loopConditionValues);
      return node;
    });

    result.set(actionId, new Workflow({ nodes, startNodeId: startByAction.get(actionId) }));
  }

  return result;
}

async function saveNodeConfig(tx: SqlExecutor, actionId: string, node: Node): Promise<void> {
  switch (node.type) {
    case "trigger":
      await saveTriggerConfig(tx, actionId, node);
      break;
    case "action":
      await saveActionConfig(tx, actionId, node);
      break;
    case "condition":
      await saveConditionConfig(tx, actionId, node);
      break;
    case "wait":
      await saveWaitConfig(tx, actionId, node);
      break;
    case "loop":
      await saveLoopConfig(tx, actionId, node);
      break;
    default:
      break;
  }
}

async function saveTriggerConfig(tx: SqlExecutor, actionId: string, node: Node): Promise<void> {
  const config = node.triggerConfig;
  if (!config?.type) return;
  await tx.execute(
    `INSERT INTO action_node_triggers (action_id, node_id, trigger_type) VALUES (?, ?, ?)`,
    [actionId, node.nodeId, config.type]
  );

  if (config.device) {
    await tx.execute(
      `INSERT INTO action_node_trigger_devices (action_id, node_id, device_id, module_id, event_type) VALUES (?, ?, ?, ?, ?)`,
      [
        actionId,
        node.nodeId,
        toStringParam(config.device.triggerDeviceId),
        toStringParam(config.device.triggerModuleId),
        toStringParam(config.device.triggerEvent)
      ]
    );
    if (config.device.triggerValues?.length) {
      const encoded = config.device.triggerValues.map(p => encodeEventParameter(p));
      await insertStoredValues(tx, "action_node_trigger_device_values", actionId, node.nodeId, encoded);
    }
  }

  if (config.time) {
    await tx.execute(
      `INSERT INTO action_node_trigger_times (action_id, node_id, frequency, time_of_day, day_of_month, month_of_year, day_of_year) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actionId,
        node.nodeId,
        toStringParam(config.time.frequency),
        toTimeParam(config.time.time),
        config.time.dayOfMonth ?? null,
        config.time.month ?? null,
        config.time.dayOfYear ?? null
      ]
    );
    for (const weekday of config.time.weekdays ?? []) {
      await tx.execute(
        `INSERT INTO action_node_trigger_time_weekdays (action_id, node_id, weekday) VALUES (?, ?, ?)`,
        [actionId, node.nodeId, weekday]
      );
    }
  }

  if (config.voiceAssistant) {
    await tx.execute(
      `INSERT INTO action_node_trigger_voice_assistants (action_id, node_id, keyword, action_type, device_id, pairing_code) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actionId,
        node.nodeId,
        toStringParam(config.voiceAssistant.keyword),
        toStringParam(config.voiceAssistant.actionType),
        toStringParam(config.voiceAssistant.deviceId),
        toStringParam(config.voiceAssistant.pairingCode)
      ]
    );
  }
}

async function saveActionConfig(tx: SqlExecutor, actionId: string, node: Node): Promise<void> {
  const config = node.actionConfig;
  if (!config) return;
  await tx.execute(
    `INSERT INTO action_node_actions (action_id, node_id, action_type, action_name, device_id, module_id, scene_id, called_action_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actionId,
      node.nodeId,
      toStringParam(config.type),
      toStringParam(config.action),
      toStringParam(config.deviceId),
      toStringParam(config.moduleId),
      toStringParam(config.sceneId),
      toStringParam(config.actionId)
    ]
  );
  await insertStoredValues(
    tx,
    "action_node_action_values",
    actionId,
    node.nodeId,
    encodeValueList(config.values)
  );
}

async function saveConditionConfig(tx: SqlExecutor, actionId: string, node: Node): Promise<void> {
  const config = node.conditionConfig;
  if (!config) return;
  await tx.execute(
    `INSERT INTO action_node_conditions (action_id, node_id, device_id, module_id, property_name) VALUES (?, ?, ?, ?, ?)`,
    [
      actionId,
      node.nodeId,
      toStringParam(config.deviceId),
      toStringParam(config.moduleId),
      toStringParam(config.property)
    ]
  );
  await insertStoredValues(
    tx,
    "action_node_condition_values",
    actionId,
    node.nodeId,
    encodeValueList(config.values as unknown[] | undefined)
  );
}

async function saveWaitConfig(tx: SqlExecutor, actionId: string, node: Node): Promise<void> {
  const config = node.waitConfig;
  if (!config) return;
  await tx.execute(
    `INSERT INTO action_node_waits (action_id, node_id, wait_type, wait_seconds, device_id, module_id, event_type, timeout_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actionId,
      node.nodeId,
      toStringParam(config.type),
      config.waitTime ?? null,
      toStringParam(config.deviceId),
      toStringParam(config.moduleId),
      toStringParam(config.triggerEvent),
      config.timeout ?? null
    ]
  );
  if (config.triggerValues?.length) {
    await insertStoredValues(
      tx,
      "action_node_wait_values",
      actionId,
      node.nodeId,
      config.triggerValues.map(p => encodeEventParameter(p))
    );
  }
}

async function saveLoopConfig(tx: SqlExecutor, actionId: string, node: Node): Promise<void> {
  const config = node.loopConfig;
  if (!config) return;
  await tx.execute(
    `INSERT INTO action_node_loops (action_id, node_id, loop_type, iteration_count, max_iterations) VALUES (?, ?, ?, ?, ?)`,
    [
      actionId,
      node.nodeId,
      toStringParam(config.type),
      config.count ?? null,
      config.maxIterations ?? null
    ]
  );
  if (config.condition) {
    await tx.execute(
      `INSERT INTO action_node_loop_conditions (action_id, node_id, device_id, module_id, property_name) VALUES (?, ?, ?, ?, ?)`,
      [
        actionId,
        node.nodeId,
        toStringParam(config.condition.deviceId),
        toStringParam(config.condition.moduleId),
        toStringParam(config.condition.property)
      ]
    );
    await insertStoredValues(
      tx,
      "action_node_loop_condition_values",
      actionId,
      node.nodeId,
      encodeValueList(config.condition.values as unknown[] | undefined)
    );
  }
}

async function saveNodeLinks(tx: SqlExecutor, actionId: string, node: Node): Promise<void> {
  await insertLinks(tx, actionId, node.nodeId, "next", node.nextNodes);
  await insertLinks(tx, actionId, node.nodeId, "true", node.trueNodes);
  await insertLinks(tx, actionId, node.nodeId, "false", node.falseNodes);
  await insertLinks(tx, actionId, node.nodeId, "loop", node.loopNodes);
}

async function insertLinks(
  tx: SqlExecutor,
  actionId: string,
  nodeId: string,
  linkType: "next" | "true" | "false" | "loop",
  targets: string[] | undefined
): Promise<void> {
  if (!targets?.length) return;
  for (let index = 0; index < targets.length; index += 1) {
    await tx.execute(SQL_INSERT_LINK, [actionId, nodeId, linkType, index, targets[index]]);
  }
}

async function insertStoredValues(
  tx: SqlExecutor,
  table: string,
  actionId: string,
  nodeId: string,
  values: readonly { valueType: StoredValueType; valueText: string | null }[]
): Promise<void> {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    await tx.execute(
      `INSERT INTO ${table} (action_id, node_id, sort_index, value_type, value_text) VALUES (?, ?, ?, ?, ?)`,
      [actionId, nodeId, index, value.valueType, value.valueText]
    );
  }
}

function attachTriggerConfig(
  node: Node,
  actionId: string,
  nodeId: string,
  triggerRows: readonly RowDataPacket[],
  deviceRows: readonly RowDataPacket[],
  timeRows: readonly RowDataPacket[],
  weekdayRows: readonly RowDataPacket[],
  voiceRows: readonly RowDataPacket[],
  valuesByKey: Map<string, ValueRow[]>
): void {
  const trigger = triggerRows.find(row => row.actionId === actionId && row.nodeId === nodeId);
  if (!trigger) return;
  node.triggerConfig = { type: trigger.triggerType as TriggerType };

  const device = deviceRows.find(row => row.actionId === actionId && row.nodeId === nodeId);
  if (device) {
    node.triggerConfig.device = {
      triggerDeviceId: device.deviceId ?? undefined,
      triggerModuleId: device.moduleId ?? undefined,
      triggerEvent: (device.eventType as EventType | null) ?? undefined,
      triggerValues: decodeValueList(valuesByKey.get(`${nodeKey(actionId, nodeId)}:triggerDevice`) ?? [], true) as never
    };
  }

  const time = timeRows.find(row => row.actionId === actionId && row.nodeId === nodeId);
  if (time) {
    node.triggerConfig.time = {
      frequency: time.frequency ?? undefined,
      time: formatTimeOfDay(time.timeOfDay),
      dayOfMonth: time.dayOfMonth ?? undefined,
      month: time.monthOfYear ?? undefined,
      dayOfYear: time.dayOfYear ?? undefined,
      weekdays: weekdayRows
        .filter(row => row.actionId === actionId && row.nodeId === nodeId)
        .map(row => Number(row.weekday))
    };
  }

  const voice = voiceRows.find(row => row.actionId === actionId && row.nodeId === nodeId);
  if (voice) {
    node.triggerConfig.voiceAssistant = {
      keyword: voice.keyword ?? undefined,
      actionType: voice.actionType ?? undefined,
      deviceId: voice.deviceId ?? undefined,
      pairingCode: voice.pairingCode ?? undefined
    };
  }
}

function attachActionConfig(
  node: Node,
  actionId: string,
  nodeId: string,
  actionRows: readonly RowDataPacket[],
  valuesByKey: Map<string, ValueRow[]>
): void {
  const row = actionRows.find(entry => entry.actionId === actionId && entry.nodeId === nodeId);
  if (!row) return;
  node.actionConfig = {
    type: row.actionType ?? undefined,
    action: row.actionName ?? undefined,
    deviceId: row.deviceId ?? undefined,
    moduleId: row.moduleId ?? undefined,
    sceneId: row.sceneId ?? undefined,
    actionId: row.calledActionId ?? undefined,
    values: decodeValueList(valuesByKey.get(`${nodeKey(actionId, nodeId)}:action`) ?? [], false)
  };
}

function attachConditionConfig(
  node: Node,
  actionId: string,
  nodeId: string,
  conditionRows: readonly RowDataPacket[],
  valuesByKey: Map<string, ValueRow[]>
): void {
  const row = conditionRows.find(entry => entry.actionId === actionId && entry.nodeId === nodeId);
  if (!row) return;
  node.conditionConfig = {
    deviceId: row.deviceId ?? undefined,
    moduleId: row.moduleId ?? undefined,
    property: row.propertyName ?? undefined,
    values: decodeValueList(valuesByKey.get(`${nodeKey(actionId, nodeId)}:condition`) ?? [], false) as Object[]
  };
}

function attachWaitConfig(
  node: Node,
  actionId: string,
  nodeId: string,
  waitRows: readonly RowDataPacket[],
  valuesByKey: Map<string, ValueRow[]>
): void {
  const row = waitRows.find(entry => entry.actionId === actionId && entry.nodeId === nodeId);
  if (!row) return;
  node.waitConfig = {
    type: row.waitType ?? undefined,
    waitTime: row.waitSeconds ?? undefined,
    deviceId: row.deviceId ?? undefined,
    moduleId: row.moduleId ?? undefined,
    triggerEvent: (row.eventType as EventType | null) ?? undefined,
    timeout: row.timeoutSeconds ?? undefined,
    triggerValues: decodeValueList(valuesByKey.get(`${nodeKey(actionId, nodeId)}:wait`) ?? [], true) as never
  };
}

function attachLoopConfig(
  node: Node,
  actionId: string,
  nodeId: string,
  loopRows: readonly RowDataPacket[],
  loopConditionRows: readonly RowDataPacket[],
  valuesByKey: Map<string, ValueRow[]>
): void {
  const row = loopRows.find(entry => entry.actionId === actionId && entry.nodeId === nodeId);
  if (!row) return;
  const conditionRow = loopConditionRows.find(entry => entry.actionId === actionId && entry.nodeId === nodeId);
  node.loopConfig = {
    type: row.loopType ?? undefined,
    count: row.iterationCount ?? undefined,
    maxIterations: row.maxIterations ?? undefined,
    condition: conditionRow
      ? {
          deviceId: conditionRow.deviceId ?? undefined,
          moduleId: conditionRow.moduleId ?? undefined,
          property: conditionRow.propertyName ?? undefined,
          values: decodeValueList(valuesByKey.get(`${nodeKey(actionId, nodeId)}:loopCondition`) ?? [], false) as Object[]
        }
      : undefined
  };
}

function groupByAction(rows: NodeRow[]): Map<string, NodeRow[]> {
  const grouped = new Map<string, NodeRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.actionId);
    if (list) list.push(row);
    else grouped.set(row.actionId, [row]);
  }
  return grouped;
}

function groupLinks(rows: LinkRow[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const key = `${nodeKey(row.actionId, row.nodeId)}:${row.linkType}`;
    const list = grouped.get(key);
    if (list) list.push(row.targetNodeId);
    else grouped.set(key, [row.targetNodeId]);
  }
  return grouped;
}

function groupValuesBySuffix(rows: ValueRow[], suffix: string): Map<string, ValueRow[]> {
  const grouped = new Map<string, ValueRow[]>();
  for (const row of rows) {
    const key = `${nodeKey(row.actionId, row.nodeId)}:${suffix}`;
    const list = grouped.get(key);
    if (list) list.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

function nodeKey(actionId: string, nodeId: string): string {
  return `${actionId}:${nodeId}`;
}

function toTimeParam(time: string | undefined): string | null {
  if (!time?.trim()) return null;
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const hours = parts[0].padStart(2, "0");
  const minutes = parts[1].padStart(2, "0");
  const seconds = (parts[2] ?? "00").padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatTimeOfDay(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
}
