import type { RowDataPacket } from "mysql2/promise";
import { Scene } from "../../actions/scene/Scene.js";
import { DbScene } from "../../model/db/DbScene.js";
import { DbSceneAction } from "../../model/db/DbSceneAction.js";
import type { DatabaseManager } from "../database.js";
import { fromNullable, toBoolean, toStringParam } from "../sqlValues.js";

const SQL_SELECT_ALL_SCENES = `
  SELECT
      s.id,
      s.name,
      s.icon,
      s.description,
      s.is_active    AS isActive,
      s.show_on_home AS showOnHome,
      s.is_custom    AS isCustom
  FROM scenes AS s
  ORDER BY s.created_at`;

const SQL_SELECT_ALL_SCENE_ACTIONS = `
  SELECT
      sa.scene_id   AS sceneId,
      sa.action_id  AS actionId,
      sa.sort_index AS sortIndex
  FROM scene_actions AS sa
  ORDER BY sa.scene_id, sa.sort_index`;

const SQL_UPSERT_SCENE = `
  INSERT INTO scenes (id, name, icon, description, is_active, show_on_home, is_custom)
  VALUES (?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      name         = incoming.name,
      icon         = incoming.icon,
      description  = incoming.description,
      is_active    = incoming.is_active,
      show_on_home = incoming.show_on_home,
      is_custom    = incoming.is_custom`;

const SQL_DELETE_SCENE_ACTIONS = `
  DELETE FROM scene_actions
  WHERE scene_id = ?`;

/** Übernimmt nur Aktionen, die tatsächlich existieren; veraltete IDs werden übersprungen. */
const SQL_INSERT_SCENE_ACTION = `
  INSERT INTO scene_actions (scene_id, action_id, sort_index)
  SELECT ?, a.id, ?
  FROM actions AS a
  WHERE a.id = ?`;

const SQL_DELETE_SCENE = `
  DELETE FROM scenes
  WHERE id = ?`;

export class SceneRepository {
  constructor(private readonly db: DatabaseManager) {}

  async findAll(): Promise<Scene[]> {
    const [sceneRows, sceneActionRows] = await Promise.all([
      this.db.query<RowDataPacket>(SQL_SELECT_ALL_SCENES),
      this.db.query<RowDataPacket>(SQL_SELECT_ALL_SCENE_ACTIONS)
    ]);

    const actionIdsByScene = new Map<string, string[]>();
    for (const sceneAction of sceneActionRows.map(toDbSceneAction)) {
      const actionIds = actionIdsByScene.get(sceneAction.sceneId) ?? [];
      actionIds.push(sceneAction.actionId);
      actionIdsByScene.set(sceneAction.sceneId, actionIds);
    }

    return sceneRows.map(row => {
      const dbScene = toDbScene(row);
      return toScene(dbScene, actionIdsByScene.get(dbScene.id) ?? []);
    });
  }

  async save(scene: Scene): Promise<void> {
    if (!scene.id) {
      throw new Error("Szene ohne ID kann nicht gespeichert werden");
    }
    const dbScene = new DbScene({
      id: scene.id,
      name: toStringParam(scene.name),
      icon: toStringParam(scene.icon),
      description: toStringParam(scene.description),
      isActive: scene.active === true,
      showOnHome: scene.showOnHome !== false,
      isCustom: scene.isCustom === true
    });
    const dbSceneActions = [...new Set(scene.actionIds ?? [])].map(
      (actionId, sortIndex) => new DbSceneAction({ sceneId: dbScene.id, actionId, sortIndex })
    );

    await this.db.transaction(async tx => {
      await tx.execute(SQL_UPSERT_SCENE, [
        dbScene.id,
        dbScene.name,
        dbScene.icon,
        dbScene.description,
        dbScene.isActive,
        dbScene.showOnHome,
        dbScene.isCustom
      ]);
      await tx.execute(SQL_DELETE_SCENE_ACTIONS, [dbScene.id]);
      for (const sceneAction of dbSceneActions) {
        await tx.execute(SQL_INSERT_SCENE_ACTION, [
          sceneAction.sceneId,
          sceneAction.sortIndex,
          sceneAction.actionId
        ]);
      }
    });
  }

  async deleteById(sceneId: string): Promise<boolean> {
    return (await this.db.execute(SQL_DELETE_SCENE, [sceneId])) > 0;
  }
}

function toDbScene(row: RowDataPacket): DbScene {
  return new DbScene({
    id: row.id,
    name: row.name,
    icon: row.icon,
    description: row.description,
    isActive: toBoolean(row.isActive),
    showOnHome: toBoolean(row.showOnHome),
    isCustom: toBoolean(row.isCustom)
  });
}

function toDbSceneAction(row: RowDataPacket): DbSceneAction {
  return new DbSceneAction({
    sceneId: row.sceneId,
    actionId: row.actionId,
    sortIndex: row.sortIndex
  });
}

function toScene(dbScene: DbScene, actionIds: string[]): Scene {
  return new Scene({
    id: dbScene.id,
    name: fromNullable(dbScene.name),
    icon: fromNullable(dbScene.icon),
    description: fromNullable(dbScene.description),
    active: dbScene.isActive,
    showOnHome: dbScene.showOnHome,
    isCustom: dbScene.isCustom,
    actionIds
  });
}
