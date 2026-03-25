/**
 * Shared types and utilities for custom font support
 * (Google Fonts + user-uploaded fonts).
 */

import type { FontMetadata } from "@excalidraw/common";

import type { ExcalidrawFontFaceDescriptor } from "./Fonts";

export interface CustomFontEntry {
  /** Numeric font-family ID (>= 10000 to avoid conflicts with built-in fonts) */
  id: number;
  /** CSS font-family name */
  family: string;
  /**
   * - Google fonts: the CSS API URL
   *   (https://fonts.googleapis.com/css2?family=...)
   * - Custom uploaded fonts: a data URL of the font binary
   */
  source: string;
  type: "google" | "custom";
  /** Approximate metrics – defaults work for most Latin fonts */
  metrics: {
    unitsPerEm: 1000 | 1024 | 2048;
    ascender: number;
    descender: number;
    lineHeight: number;
  };
  /**
   * Resolved font-face descriptors.
   * - For Google fonts this is populated after fetching the CSS API.
   * - For custom fonts this is a single entry with the data URL.
   * Stored in IDB so we can re-register fonts on reload without re-fetching.
   */
  descriptors: ExcalidrawFontFaceDescriptor[];
}

/** Derive a stable numeric ID from a family name (always >= 10000). */
export const familyToId = (family: string): number => {
  let hash = 0;
  for (let i = 0; i < family.length; i++) {
    hash = (Math.imul(31, hash) + family.charCodeAt(i)) | 0;
  }
  return 10000 + (Math.abs(hash) % 90000);
};

/** Sensible default metrics for most Latin web fonts. */
export const DEFAULT_CUSTOM_FONT_METRICS: FontMetadata["metrics"] = {
  unitsPerEm: 1000,
  ascender: 1011,
  descender: -353,
  lineHeight: 1.25,
};
