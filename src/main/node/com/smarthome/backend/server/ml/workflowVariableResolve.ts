/** Löst `{{var:name}}`-Platzhalter in Workflow-Argumenten auf. */
export function resolveWorkflowArgFromEnvironment(
  value: unknown,
  environment: Map<string, unknown>
): unknown {
  if (value !== null && typeof value === "object" && "manual" in value && "value" in value) {
    const inner = (value as { value: unknown }).value;
    const resolved = resolveWorkflowArgFromEnvironment(inner, environment);
    return { ...(value as object), value: resolved };
  }
  if (typeof value !== "string") return value;
  const match = value.match(/^\{\{var:([^}]+)\}\}$/);
  if (!match) return value;
  const raw = environment.get(`var:${match[1]}`);
  if (raw === undefined || raw === null || raw === "") return value;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && String(asNum) === String(raw).trim()) {
    return asNum;
  }
  return raw;
}

export function resolveWorkflowArgListFromEnvironment(
  values: unknown[] | undefined,
  environment: Map<string, unknown>
): unknown[] {
  if (!values?.length) return [];
  return values.map((v) => resolveWorkflowArgFromEnvironment(v, environment));
}
