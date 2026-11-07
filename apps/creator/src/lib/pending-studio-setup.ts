export type PendingStudioSetupData = {
  studioName: string;
  logoFile: File | null;
  removeLogo: boolean;
  contactName: string;
  contactRole: string;
  officialEmail: string;
  websiteUrl: string;
  description: string;
};

export type PendingStudioSetupStage = "company" | "account";

export type PendingStudioSetupDraft = {
  data: PendingStudioSetupData;
  step: number;
  stage: PendingStudioSetupStage;
  savedAt: number;
};

type StoredDraft = {
  id: "active";
  version: 1;
  savedAt: number;
  expiresAt: number;
  step: number;
  stage: PendingStudioSetupStage;
  data: Omit<PendingStudioSetupData, "logoFile"> & {
    logoBlob: Blob | null;
    logoName: string | null;
    logoType: string | null;
    logoLastModified: number | null;
  };
};

const DATABASE_NAME = "game-on-creator-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "pending-setup";
const DRAFT_TTL_MS = 72 * 60 * 60 * 1000;
let writeQueue: Promise<void> = Promise.resolve();

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredDraft>;
  const data = candidate.data as Partial<StoredDraft["data"]> | undefined;
  return candidate.id === "active"
    && candidate.version === 1
    && typeof candidate.savedAt === "number"
    && Number.isFinite(candidate.savedAt)
    && typeof candidate.expiresAt === "number"
    && Number.isFinite(candidate.expiresAt)
    && Number.isInteger(candidate.step)
    && (candidate.step as number) >= 0
    && (candidate.step as number) <= 5
    && (candidate.stage === "company" || candidate.stage === "account")
    && Boolean(data)
    && typeof data?.studioName === "string"
    && typeof data?.removeLogo === "boolean"
    && typeof data?.contactName === "string"
    && typeof data?.contactRole === "string"
    && typeof data?.officialEmail === "string"
    && typeof data?.websiteUrl === "string"
    && typeof data?.description === "string"
    && (data?.logoBlob === null || data?.logoBlob instanceof Blob)
    && (data?.logoName === null || typeof data?.logoName === "string")
    && (data?.logoType === null || typeof data?.logoType === "string")
    && (data?.logoLastModified === null || typeof data?.logoLastModified === "number");
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("This browser does not support local draft storage. Use an up-to-date browser and keep this tab open."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Company setup storage could not be opened."));
    request.onblocked = () => reject(new Error("Company setup storage is busy in another tab. Close other GAME ON Creator tabs and try again."));
  });
}

function saveInOrder(record: StoredDraft): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("Company setup could not be saved in this browser."));
        transaction.onabort = () => reject(transaction.error || new Error("Company setup save was interrupted."));
      });
    } finally {
      database.close();
    }
  });
  return writeQueue;
}

export async function savePendingStudioSetupDraft(
  data: PendingStudioSetupData,
  step: number,
  stage: PendingStudioSetupStage,
): Promise<void> {
  const savedAt = Date.now();
  const safeStep = Number.isFinite(step) ? Math.max(0, Math.min(5, Math.floor(step))) : 0;
  const logoFile = data.logoFile;
  const record: StoredDraft = {
    id: "active",
    version: 1,
    savedAt,
    expiresAt: savedAt + DRAFT_TTL_MS,
    step: safeStep,
    stage,
    data: {
      studioName: data.studioName,
      removeLogo: data.removeLogo,
      contactName: data.contactName,
      contactRole: data.contactRole,
      officialEmail: data.officialEmail,
      websiteUrl: data.websiteUrl,
      description: data.description,
      logoBlob: logoFile ? logoFile.slice(0, logoFile.size, logoFile.type) : null,
      logoName: logoFile?.name || null,
      logoType: logoFile?.type || null,
      logoLastModified: logoFile?.lastModified || null,
    },
  };
  await saveInOrder(record);
}

export async function loadPendingStudioSetupDraft(): Promise<PendingStudioSetupDraft | null> {
  const database = await openDatabase();
  let record: StoredDraft | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get("active");
      request.onsuccess = () => {
        record = request.result as StoredDraft | undefined;
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Saved company setup could not be read."));
      transaction.onabort = () => reject(transaction.error || new Error("Saved company setup could not be read."));
    });
  } finally {
    database.close();
  }

  if (!record) return null;
  if (!isStoredDraft(record) || record.expiresAt <= Date.now()) {
    await clearPendingStudioSetupDraft();
    return null;
  }

  const stored = record.data;
  let logoFile: File | null = null;
  if (stored.logoBlob && stored.logoName && stored.logoType) {
    logoFile = new File([stored.logoBlob], stored.logoName, {
      type: stored.logoType,
      lastModified: stored.logoLastModified || record.savedAt,
    });
  }

  return {
    data: {
      studioName: stored.studioName,
      logoFile,
      removeLogo: stored.removeLogo,
      contactName: stored.contactName,
      contactRole: stored.contactRole,
      officialEmail: stored.officialEmail,
      websiteUrl: stored.websiteUrl,
      description: stored.description,
    },
    step: record.step,
    stage: record.stage,
    savedAt: record.savedAt,
  };
}

export function clearPendingStudioSetupDraft(): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete("active");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("Saved company setup could not be cleared."));
        transaction.onabort = () => reject(transaction.error || new Error("Saved company setup could not be cleared."));
      });
    } finally {
      database.close();
    }
  });
  return writeQueue;
}

export const PENDING_STUDIO_SETUP_TTL_HOURS = DRAFT_TTL_MS / (60 * 60 * 1000);
