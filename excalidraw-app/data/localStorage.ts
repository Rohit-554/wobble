import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { createStore, get } from "idb-keyval";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

const sceneStore = createStore("scene-db", "scene-store");

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

export const importFromLocalStorage = async () => {
  try {
    const data = await get<{ elements: ExcalidrawElement[]; appState: Partial<AppState> }>(
      STORAGE_KEYS.IDB_SCENE,
      sceneStore,
    );

    if (data) {
      return {
        elements: data.elements ?? [],
        appState: {
          ...getDefaultAppState(),
          ...clearAppStateForLocalStorage(data.appState),
        },
      };
    }
  } catch (error: any) {
    console.error(error);
  }

  // fallback: migrate from legacy localStorage if present
  try {
    const savedElements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    const savedState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);

    const elements: ExcalidrawElement[] = savedElements ? JSON.parse(savedElements) : [];
    const appState = savedState
      ? {
          ...getDefaultAppState(),
          ...clearAppStateForLocalStorage(JSON.parse(savedState) as Partial<AppState>),
        }
      : null;

    return { elements, appState };
  } catch (error: any) {
    console.error(error);
  }

  return { elements: [], appState: null };
};

export const getElementsStorageSize = () => {
  try {
    const elements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    const elementsSize = elements?.length || 0;
    return elementsSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const getTotalStorageSize = () => {
  try {
    const appState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
    const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);

    const appStateSize = appState?.length || 0;
    const collabSize = collab?.length || 0;

    return appStateSize + collabSize + getElementsStorageSize();
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};
