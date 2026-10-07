import type { RowDataPacket } from "mysql2/promise";
import { DbRoom } from "../../model/db/DbRoom.js";
import { DbRoomPoint } from "../../model/db/DbRoomPoint.js";
import { Room } from "../../model/Room.js";
import type { Position } from "../../actions/action/Position.js";
import type { DatabaseManager, SqlExecutor } from "../database.js";
import { fromNullable, toNumberParam, toStringParam } from "../sqlValues.js";

const SQL_SELECT_ROOMS = `
  SELECT
      r.id,
      r.name,
      r.icon,
      r.color,
      r.temperature,
      r.pos_x      AS posX,
      r.pos_y      AS posY,
      r.width,
      r.height,
      r.sort_index AS sortIndex
  FROM rooms AS r`;

const SQL_SELECT_ALL_ROOMS = `${SQL_SELECT_ROOMS}
  ORDER BY r.sort_index, r.name`;

const SQL_SELECT_ROOM_BY_ID = `${SQL_SELECT_ROOMS}
  WHERE r.id = ?`;

const SQL_SELECT_ROOM_POINTS = `
  SELECT
      rp.room_id     AS roomId,
      rp.point_index AS pointIndex,
      rp.x,
      rp.y
  FROM room_points AS rp`;

const SQL_SELECT_ALL_ROOM_POINTS = `${SQL_SELECT_ROOM_POINTS}
  ORDER BY rp.room_id, rp.point_index`;

const SQL_SELECT_ROOM_POINTS_BY_ROOM = `${SQL_SELECT_ROOM_POINTS}
  WHERE rp.room_id = ?
  ORDER BY rp.point_index`;

const SQL_SELECT_ROOM_IDS = `
  SELECT r.id
  FROM rooms AS r`;

const SQL_SELECT_NEXT_SORT_INDEX = `
  SELECT COALESCE(MAX(r.sort_index) + 1, 0) AS nextSortIndex
  FROM rooms AS r`;

const SQL_UPSERT_ROOM = `
  INSERT INTO rooms (id, name, icon, color, temperature, pos_x, pos_y, width, height, sort_index)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
  ON DUPLICATE KEY UPDATE
      name        = incoming.name,
      icon        = incoming.icon,
      color       = incoming.color,
      temperature = incoming.temperature,
      pos_x       = incoming.pos_x,
      pos_y       = incoming.pos_y,
      width       = incoming.width,
      height      = incoming.height,
      sort_index  = incoming.sort_index`;

const SQL_DELETE_ROOM_POINTS = `
  DELETE FROM room_points
  WHERE room_id = ?`;

const SQL_INSERT_ROOM_POINT = `
  INSERT INTO room_points (room_id, point_index, x, y)
  VALUES (?, ?, ?, ?)`;

/** Punkte werden per ON DELETE CASCADE, Geräte-Zuordnungen per ON DELETE SET NULL bereinigt. */
const SQL_DELETE_ROOM = `
  DELETE FROM rooms
  WHERE id = ?`;

export class RoomRepository {
  constructor(private readonly db: DatabaseManager) {}

  async findAll(): Promise<Room[]> {
    const [roomRows, pointRows] = await Promise.all([
      this.db.query<RowDataPacket>(SQL_SELECT_ALL_ROOMS),
      this.db.query<RowDataPacket>(SQL_SELECT_ALL_ROOM_POINTS)
    ]);

    const pointsByRoom = new Map<string, DbRoomPoint[]>();
    for (const point of pointRows.map(toDbRoomPoint)) {
      const points = pointsByRoom.get(point.roomId) ?? [];
      points.push(point);
      pointsByRoom.set(point.roomId, points);
    }

    return roomRows.map(row => {
      const dbRoom = toDbRoom(row);
      return toRoom(dbRoom, pointsByRoom.get(dbRoom.id) ?? []);
    });
  }

  async findById(id: string): Promise<Room | null> {
    const [row] = await this.db.query<RowDataPacket>(SQL_SELECT_ROOM_BY_ID, [id]);
    if (!row) return null;
    const pointRows = await this.db.query<RowDataPacket>(SQL_SELECT_ROOM_POINTS_BY_ROOM, [id]);
    return toRoom(toDbRoom(row), pointRows.map(toDbRoomPoint));
  }

  async findNextSortIndex(): Promise<number> {
    const [row] = await this.db.query<RowDataPacket>(SQL_SELECT_NEXT_SORT_INDEX);
    return Number(row?.nextSortIndex ?? 0);
  }

  async save(room: Room): Promise<void> {
    await this.db.transaction(tx => saveRoom(tx, room, room.index ?? 0));
  }

  /** Ersetzt den kompletten Grundriss und liefert die IDs der entfernten Räume. */
  async replaceAll(rooms: Room[]): Promise<string[]> {
    return this.db.transaction(async tx => {
      const existingIds = (await tx.query<RowDataPacket>(SQL_SELECT_ROOM_IDS)).map(row => row.id as string);
      const keptIds = new Set<string>();

      for (const [position, room] of rooms.entries()) {
        if (!room.id) continue;
        await saveRoom(tx, room, room.index ?? position);
        keptIds.add(room.id);
      }

      const removedIds = existingIds.filter(id => !keptIds.has(id));
      for (const id of removedIds) {
        await tx.execute(SQL_DELETE_ROOM, [id]);
      }
      return removedIds;
    });
  }

  async deleteById(id: string): Promise<boolean> {
    return (await this.db.execute(SQL_DELETE_ROOM, [id])) > 0;
  }
}

async function saveRoom(tx: SqlExecutor, room: Room, sortIndex: number): Promise<void> {
  if (!room.id) {
    throw new Error("Raum ohne ID kann nicht gespeichert werden");
  }
  const dbRoom = new DbRoom({
    id: room.id,
    name: toStringParam(room.name),
    icon: toStringParam(room.icon),
    color: toStringParam(room.color),
    temperature: toNumberParam(room.temperature),
    posX: toNumberParam(room.x),
    posY: toNumberParam(room.y),
    width: toNumberParam(room.width),
    height: toNumberParam(room.height),
    sortIndex
  });
  const dbPoints = (room.points ?? []).map(
    (point, pointIndex) =>
      new DbRoomPoint({
        roomId: dbRoom.id,
        pointIndex,
        x: toNumberParam(point.x) ?? 0,
        y: toNumberParam(point.y) ?? 0
      })
  );

  await tx.execute(SQL_UPSERT_ROOM, [
    dbRoom.id,
    dbRoom.name,
    dbRoom.icon,
    dbRoom.color,
    dbRoom.temperature,
    dbRoom.posX,
    dbRoom.posY,
    dbRoom.width,
    dbRoom.height,
    dbRoom.sortIndex
  ]);

  await tx.execute(SQL_DELETE_ROOM_POINTS, [dbRoom.id]);
  for (const point of dbPoints) {
    await tx.execute(SQL_INSERT_ROOM_POINT, [point.roomId, point.pointIndex, point.x, point.y]);
  }
}

function toDbRoom(row: RowDataPacket): DbRoom {
  return new DbRoom({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    temperature: row.temperature,
    posX: row.posX,
    posY: row.posY,
    width: row.width,
    height: row.height,
    sortIndex: row.sortIndex
  });
}

function toDbRoomPoint(row: RowDataPacket): DbRoomPoint {
  return new DbRoomPoint({
    roomId: row.roomId,
    pointIndex: row.pointIndex,
    x: row.x,
    y: row.y
  });
}

function toRoom(dbRoom: DbRoom, dbPoints: DbRoomPoint[]): Room {
  return new Room({
    id: dbRoom.id,
    name: fromNullable(dbRoom.name),
    icon: fromNullable(dbRoom.icon),
    color: fromNullable(dbRoom.color),
    temperature: fromNullable(dbRoom.temperature),
    x: fromNullable(dbRoom.posX),
    y: fromNullable(dbRoom.posY),
    width: fromNullable(dbRoom.width),
    height: fromNullable(dbRoom.height),
    index: dbRoom.sortIndex,
    points: dbPoints.map((point): Position => ({ x: point.x, y: point.y }))
  });
}
