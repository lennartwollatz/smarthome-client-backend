import { ActionRunnableEnvironment } from "./ActionRunnableEnvironment.js";

export interface ActionRunnableResponse {
    environment: ActionRunnableEnvironment;
    error?: string;
    warning?: string;
    success: boolean;
}