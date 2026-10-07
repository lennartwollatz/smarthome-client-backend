import type { EventParameter } from "../../../events/event-types/EventParameter.js";

export type StoredValueType = "string" | "number" | "boolean" | "null";

export type StoredValue = {
  valueType: StoredValueType;
  valueText: string | null;
};

const EVENT_PARAM_PREFIX = "eventParam:";

export function encodePrimitive(value: unknown): StoredValue {
  if (value === null || value === undefined) {
    return { valueType: "null", valueText: null };
  }
  if (typeof value === "boolean") {
    return { valueType: "boolean", valueText: value ? "true" : "false" };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { valueType: "number", valueText: String(value) };
  }
  return { valueType: "string", valueText: String(value) };
}

export function decodePrimitive(stored: StoredValue): unknown {
  switch (stored.valueType) {
    case "null":
      return null;
    case "boolean":
      return stored.valueText === "true";
    case "number":
      return stored.valueText == null ? null : Number(stored.valueText);
    default:
      return stored.valueText ?? "";
  }
}

export function encodeEventParameter(parameter: EventParameter): StoredValue {
  return {
    valueType: "string",
    valueText: `${EVENT_PARAM_PREFIX}${JSON.stringify(parameter)}`
  };
}

export function decodeEventParameter(stored: StoredValue, sortIndex: number): EventParameter {
  if (stored.valueType === "string" && stored.valueText?.startsWith(EVENT_PARAM_PREFIX)) {
    return JSON.parse(stored.valueText.slice(EVENT_PARAM_PREFIX.length)) as EventParameter;
  }
  const value = decodePrimitive(stored);
  return {
    id: sortIndex + 1,
    name: `arg${sortIndex}`,
    type: typeof value === "boolean" ? "bool" : typeof value === "number" ? "num" : "str",
    value: value as string | number | boolean
  };
}

export function encodeValueList(values: unknown[] | undefined): StoredValue[] {
  if (!values?.length) return [];
  return values.map(value =>
    isEventParameter(value) ? encodeEventParameter(value) : encodePrimitive(value)
  );
}

export function decodeValueList(
  rows: readonly { sortIndex: number; valueType: StoredValueType; valueText: string | null }[],
  asEventParameters: boolean
): unknown[] {
  return rows
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map(row =>
      asEventParameters
        ? decodeEventParameter(row, row.sortIndex)
        : decodePrimitive(row)
    );
}

function isEventParameter(value: unknown): value is EventParameter {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "type" in value &&
    "value" in value
  );
}
