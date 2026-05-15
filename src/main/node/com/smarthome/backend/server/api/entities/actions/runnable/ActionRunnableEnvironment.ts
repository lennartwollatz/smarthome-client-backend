export interface ActionRunnableEnvironment {
    environment: Map<string, unknown>;
    /** Aktive Ausführungs-ID (für verschachtelte Actions). */
    executionId?: string;
    parentExecutionId?: string;
}