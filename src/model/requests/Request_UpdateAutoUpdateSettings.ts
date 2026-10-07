import { Request_SystemSettings } from "./Request_Settings.js";

/** PUT /api/settings/system/auto-update – nur gesetzte Werte werden übernommen. */
export class Request_UpdateAutoUpdateSettings extends Request_SystemSettings {}
