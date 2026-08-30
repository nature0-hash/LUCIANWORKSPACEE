// Persistence for Project Agent conversations.
//
// Conversations live in their own IndexedDB store `agent_conversations`,
// keyed by projectId. Kept separate from the `projects` store so the
// projects list (loaded in full on app start) stays small even if a project
// has hundreds of agent messages.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AgentConversation } from "./types";

const DB_NAME = "lucian-agent-db";
const DB_VERSION = 1;
const STORE = "agent_conversations";

interface AgentDB extends DBSchema {
  [STORE]: {
    key: string; // projectId
    value: AgentConversation;
  };
}

let dbPromise: Promise<IDBPDatabase<AgentDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<AgentDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "projectId" });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadConversation(projectId: string): Promise<AgentConversation | undefined> {
  const db = await getDB();
  return db.get(STORE, projectId);
}

export async function saveConversation(conversation: AgentConversation): Promise<void> {
  const db = await getDB();
  conversation.updatedAt = Date.now();
  await db.put(STORE, conversation);
}

export async function deleteConversation(projectId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, projectId);
}
