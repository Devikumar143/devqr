import * as SQLite from 'expo-sqlite';
import { StoredSession, DebugBundle, DebugAnalysis } from '../types';

export class SQLiteSessionStorage {
  private static db: SQLite.SQLiteDatabase | null = null;

  public static async getDB(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync('devqr_sessions.db');
      await this.db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          bundle_json TEXT NOT NULL,
          analysis_json TEXT,
          chat_history_json TEXT
        );
      `);
    }
    return this.db;
  }

  public static async getSessions(): Promise<StoredSession[]> {
    try {
      const db = await this.getDB();
      const rows = await db.getAllAsync<any>('SELECT * FROM sessions ORDER BY timestamp DESC LIMIT 100;');
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        timestamp: r.timestamp,
        bundle: JSON.parse(r.bundle_json),
        analysis: r.analysis_json ? JSON.parse(r.analysis_json) : undefined,
        chatHistory: r.chat_history_json ? JSON.parse(r.chat_history_json) : []
      }));
    } catch {
      return [];
    }
  }

  public static async saveSession(bundle: DebugBundle, analysis?: DebugAnalysis): Promise<StoredSession> {
    const db = await this.getDB();
    const id = bundle.sessionId || `DVQR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const title = `${bundle.project?.name || 'Project'} • ${bundle.error?.message.slice(0, 35)}...`;
    const timestamp = Date.now();

    await db.runAsync(
      `INSERT OR REPLACE INTO sessions (id, title, timestamp, bundle_json, analysis_json, chat_history_json)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        id,
        title,
        timestamp,
        JSON.stringify(bundle),
        analysis ? JSON.stringify(analysis) : null,
        JSON.stringify([])
      ]
    );

    return { id, title, timestamp, bundle, analysis, chatHistory: [] };
  }

  public static async addChatMessage(sessionId: string, message: { role: 'user' | 'assistant'; content: string }): Promise<void> {
    const db = await this.getDB();
    const row = await db.getFirstAsync<any>('SELECT chat_history_json FROM sessions WHERE id = ?;', [sessionId]);
    if (row) {
      const history = row.chat_history_json ? JSON.parse(row.chat_history_json) : [];
      history.push({ ...message, timestamp: Date.now() });
      await db.runAsync('UPDATE sessions SET chat_history_json = ? WHERE id = ?;', [JSON.stringify(history), sessionId]);
    }
  }

  public static async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();
    await db.runAsync('DELETE FROM sessions WHERE id = ?;', [id]);
  }

  public static async clearAll(): Promise<void> {
    const db = await this.getDB();
    await db.runAsync('DELETE FROM sessions;');
  }
}
