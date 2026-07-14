import fs from "fs/promises";
import path from "path";
import { sql } from "drizzle-orm";

import { db, isDatabaseRequired } from "../../db";
import { HUB_DIR } from "../../utils/repoPaths";
import type {
  AssessmentAttempt,
  CourseSource,
  LearningAssessment,
  LearningBlueprint,
  LearningLesson,
  LearningObject,
  LearningObjectType,
  LearningPath,
  LearningPathDetail,
  LearningUnit,
  MasteryRecord,
} from "../../../shared/learning-types";

type LearningState = {
  version: string;
  updatedAt: string;
  objects: Partial<Record<LearningObjectType, LearningObject[]>>;
};

const LEARNING_DIR = path.join(HUB_DIR, "learning");
let ensured: Promise<void> | null = null;

function fileFor(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LEARNING_DIR, `${safe}.json`);
}

function objectIdFor(type: LearningObjectType, object: LearningObject): string {
  return type === "learning_blueprint"
    ? (object as LearningBlueprint).pathId
    : (object as { id: string }).id;
}

async function ensureTable(): Promise<boolean> {
  if (!db) return false;
  if (!ensured) {
    ensured = db.execute(sql`
      CREATE TABLE IF NOT EXISTS learning_state (
        user_id varchar NOT NULL REFERENCES users(id),
        object_type text NOT NULL,
        object_id varchar NOT NULL,
        data jsonb NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        PRIMARY KEY (user_id, object_type, object_id)
      );
    `).then(async () => {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_learning_state_user_type
        ON learning_state (user_id, object_type, updated_at DESC);
      `);
    }).catch((error) => {
      ensured = null;
      throw error;
    });
  }
  try {
    await ensured;
    return true;
  } catch {
    return false;
  }
}

async function readFileState(userId: string): Promise<LearningState> {
  try {
    const raw = await fs.readFile(fileFor(userId), "utf-8");
    const parsed = JSON.parse(raw) as LearningState;
    return {
      version: parsed.version || "1",
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      objects: parsed.objects || {},
    };
  } catch {
    return { version: "1", updatedAt: new Date().toISOString(), objects: {} };
  }
}

async function writeFileState(userId: string, state: LearningState): Promise<void> {
  await fs.mkdir(LEARNING_DIR, { recursive: true });
  await fs.writeFile(fileFor(userId), JSON.stringify(state, null, 2), "utf-8");
}

async function upsertFileObject(
  userId: string,
  type: LearningObjectType,
  object: LearningObject,
): Promise<void> {
  const state = await readFileState(userId);
  const id = objectIdFor(type, object);
  const list = state.objects[type] || [];
  const nextList = list.some((item) => objectIdFor(type, item) === id)
    ? list.map((item) => (objectIdFor(type, item) === id ? object : item))
    : [...list, object];
  state.objects[type] = nextList;
  state.updatedAt = new Date().toISOString();
  await writeFileState(userId, state);
}

async function listFileObjects<T extends LearningObject>(
  userId: string,
  type: LearningObjectType,
): Promise<T[]> {
  const state = await readFileState(userId);
  return ((state.objects[type] || []) as T[]).slice();
}

function rowsFrom(result: any): any[] {
  return result?.rows ?? (Array.isArray(result) ? result : []);
}

export class LearningStore {
  static async writeObject<T extends LearningObject>(
    userId: string,
    type: LearningObjectType,
    object: T,
  ): Promise<T> {
    const objectId = objectIdFor(type, object);
    const now = new Date().toISOString();
    const payload = JSON.stringify(object);
    const canUseDb = await ensureTable();
    if (canUseDb) {
      try {
        await db!.execute(sql`
          INSERT INTO learning_state (user_id, object_type, object_id, data, updated_at)
          VALUES (${userId}, ${type}, ${objectId}, ${payload}::jsonb, now())
          ON CONFLICT (user_id, object_type, object_id)
          DO UPDATE SET data = EXCLUDED.data, updated_at = now();
        `);
      } catch (error) {
        if (isDatabaseRequired()) throw error;
      }
    } else if (isDatabaseRequired()) {
      throw new Error("learning_state requires PostgreSQL in this environment.");
    }

    if (!isDatabaseRequired()) {
      await upsertFileObject(userId, type, object);
    }
    return { ...object, updatedAt: (object as any).updatedAt || now } as T;
  }

  static async writeObjects(
    userId: string,
    entries: Array<{ type: LearningObjectType; object: LearningObject }>,
  ): Promise<void> {
    for (const entry of entries) {
      await this.writeObject(userId, entry.type, entry.object);
    }
  }

  static async listObjects<T extends LearningObject>(
    userId: string,
    type: LearningObjectType,
  ): Promise<T[]> {
    if (await ensureTable()) {
      try {
        const result = await db!.execute(sql`
          SELECT data FROM learning_state
          WHERE user_id = ${userId} AND object_type = ${type}
          ORDER BY updated_at DESC;
        `);
        const rows = rowsFrom(result);
        if (rows.length > 0) return rows.map((row) => row.data as T);
      } catch (error) {
        if (isDatabaseRequired()) throw error;
        /* file fallback below */
      }
    } else if (isDatabaseRequired()) {
      throw new Error("learning_state requires PostgreSQL in this environment.");
    }
    if (isDatabaseRequired()) return [];
    return listFileObjects<T>(userId, type);
  }

  static async getObject<T extends LearningObject>(
    userId: string,
    type: LearningObjectType,
    objectId: string,
  ): Promise<T | null> {
    const all = await this.listObjects<T>(userId, type);
    return all.find((object) => objectIdFor(type, object) === objectId) || null;
  }

  static async listPaths(userId: string): Promise<LearningPath[]> {
    const paths = await this.listObjects<LearningPath>(userId, "learning_path");
    return paths.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  static async getPathDetail(userId: string, pathId: string): Promise<LearningPathDetail | null> {
    const pathObject = await this.getObject<LearningPath>(userId, "learning_path", pathId);
    if (!pathObject) return null;
    const [
      blueprint,
      sources,
      units,
      lessons,
      assessments,
      attempts,
      mastery,
    ] = await Promise.all([
      this.getObject<LearningBlueprint>(userId, "learning_blueprint", pathId),
      this.listObjects<CourseSource>(userId, "course_source"),
      this.listObjects<LearningUnit>(userId, "unit"),
      this.listObjects<LearningLesson>(userId, "lesson"),
      this.listObjects<LearningAssessment>(userId, "assessment"),
      this.listObjects<AssessmentAttempt>(userId, "attempt"),
      this.listObjects<MasteryRecord>(userId, "mastery_record"),
    ]);
    return {
      path: pathObject,
      blueprint: blueprint || undefined,
      sources: sources.filter((item) => item.pathId === pathId),
      units: units.filter((item) => item.pathId === pathId).sort((a, b) => a.order - b.order),
      lessons: lessons.filter((item) => item.pathId === pathId).sort((a, b) => a.order - b.order),
      assessments: assessments.filter((item) => item.pathId === pathId),
      attempts: attempts.filter((item) => item.pathId === pathId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      mastery: mastery.filter((item) => item.pathId === pathId),
    };
  }
}

export default LearningStore;
