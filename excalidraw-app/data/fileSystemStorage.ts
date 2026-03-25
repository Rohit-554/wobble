/**
 * File System Access API helpers.
 *
 * Lets the user opt in to saving their Excalidraw scene directly to a local
 * file on their computer instead of (or in addition to) IndexedDB.  The file
 * handle is persisted in IndexedDB so the app can re-use it across reloads
 * without asking again (as long as the user has not revoked permission).
 *
 * Browser support: Chrome / Edge 86+.  On unsupported browsers every method
 * is a no-op / returns null so callers don't need feature-check boilerplate.
 */

import { FileSystemHandleData } from "./LocalData";

export const isFileSystemAccessSupported = (): boolean =>
  typeof window !== "undefined" && "showSaveFilePicker" in window;

/**
 * Ask the user to pick a location and file name for auto-saving.
 * Stores the resulting handle in IDB and returns it.
 * Returns null if the user cancelled or the API is unsupported.
 */
export const requestSaveLocation =
  async (): Promise<FileSystemFileHandle | null> => {
    if (!isFileSystemAccessSupported()) {
      return null;
    }
    try {
      const handle = await (
        window as typeof window & {
          showSaveFilePicker: (opts?: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        types: [
          {
            description: "Wobble file",
            accept: { "application/json": [".excalidraw"] },
          },
        ],
        suggestedName: "drawing.excalidraw",
      });
      await FileSystemHandleData.save(handle);
      return handle;
    } catch {
      // user cancelled the picker – not an error
      return null;
    }
  };

/**
 * Re-request read+write permission for a previously stored handle.
 * Returns true if permission was granted.
 */
export const requestHandlePermission = async (
  handle: FileSystemFileHandle,
): Promise<boolean> => {
  try {
    const h = handle as FileSystemFileHandle & {
      queryPermission: (opts: { mode: string }) => Promise<string>;
      requestPermission: (opts: { mode: string }) => Promise<string>;
    };
    const existing = await h.queryPermission({ mode: "readwrite" });
    if (existing === "granted") {
      return true;
    }
    const requested = await h.requestPermission({ mode: "readwrite" });
    return requested === "granted";
  } catch {
    return false;
  }
};

/**
 * Write serialised scene JSON to the given file handle.
 * Silent no-op on failure (logs error to console).
 */
export const saveToFileHandle = async (
  handle: FileSystemFileHandle,
  json: string,
): Promise<void> => {
  try {
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
  } catch (err) {
    console.error("[FileSystemStorage] Failed to save:", err);
  }
};

/**
 * Read the scene JSON from the given file handle.
 * Returns null on any error (e.g. file deleted, permission revoked).
 */
export const loadFromFileHandle = async (
  handle: FileSystemFileHandle,
): Promise<string | null> => {
  try {
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
};
