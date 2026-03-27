import { LiveUpdateService } from "../services/live.service.js";

export interface EntityManager {
    setLiveUpdateService(service: LiveUpdateService): void;
}