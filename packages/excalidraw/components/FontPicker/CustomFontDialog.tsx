import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Dialog } from "../Dialog";
import { t } from "../../i18n";

import {
  familyToId,
  DEFAULT_CUSTOM_FONT_METRICS,
} from "../../fonts/customFonts";

import type { CustomFontEntry } from "../../fonts/customFonts";
import { GOOGLE_FONTS_LIST } from "../../fonts/googleFontsList";
import type { GFontMeta } from "../../fonts/googleFontsList";

import "./CustomFontDialog.scss";

// ---------------------------------------------------------------------------
// Google Fonts CSS descriptors
// ---------------------------------------------------------------------------

async function fetchGoogleFontDescriptors(
  family: string,
): Promise<Array<{ uri: string; descriptors?: FontFaceDescriptors }>> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}&display=swap`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Fonts CSS request failed: ${response.status}`);
  }

  const css = await response.text();
  const descriptors: Array<{ uri: string; descriptors?: FontFaceDescriptors }> =
    [];

  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = fontFaceRegex.exec(css)) !== null) {
    const block = match[1];
    const srcMatch = block.match(/src:\s*url\(([^)]+)\)/);
    const unicodeMatch = block.match(/unicode-range:\s*([^;]+);/);
    const weightMatch = block.match(/font-weight:\s*([^;]+);/);
    const styleMatch = block.match(/font-style:\s*([^;]+);/);

    if (!srcMatch) {
      continue;
    }

    const uri = srcMatch[1].trim().replace(/['"]/g, "");
    const descr: FontFaceDescriptors = {};
    if (unicodeMatch) {
      descr.unicodeRange = unicodeMatch[1].trim();
    }
    if (weightMatch) {
      descr.weight = weightMatch[1].trim();
    }
    if (styleMatch) {
      descr.style = styleMatch[1].trim();
    }
    descriptors.push({ uri, descriptors: descr });
  }

  if (descriptors.length === 0) {
    throw new Error(`No @font-face rules found for "${family}"`);
  }

  return descriptors;
}

/** Inject a Google Fonts <link> tag for a given family (idempotent). */
function injectGoogleFontLink(family: string) {
  const id = `gf-link-${familyToId(family)}`;
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}&display=swap`;
    document.head.appendChild(link);
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    className={`custom-font-dialog__tab${
      active ? " custom-font-dialog__tab--active" : ""
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Google Fonts browser panel
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "all",
  "sans-serif",
  "serif",
  "display",
  "handwriting",
  "monospace",
] as const;
type Category = (typeof CATEGORIES)[number];

const PREVIEW_TEXT = "AaBbCc 012";

interface GoogleFontsPanelProps {
  onFontAdded: (entry: CustomFontEntry) => void;
  onClose: () => void;
}

const GoogleFontsPanel = ({ onFontAdded, onClose }: GoogleFontsPanelProps) => {
  const fonts = GOOGLE_FONTS_LIST;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");

  const [selected, setSelected] = useState<GFontMeta | null>(null);
  const [addState, setAddState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [addError, setAddError] = useState("");

  // Fonts whose <link> tag has been injected (for preview)
  const injectedRef = useRef<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return fonts.filter(
      (f) =>
        (category === "all" || f.category === category) &&
        (!q || f.family.toLowerCase().includes(q)),
    );
  }, [fonts, search, category]);

  // Inject preview link tags for visible fonts (lazily, on scroll)
  // We rely on IntersectionObserver per item but for simplicity just inject
  // when the item becomes selected or hovered.
  const handleSelect = useCallback((font: GFontMeta) => {
    setSelected(font);
    setAddState("idle");
    setAddError("");
    if (!injectedRef.current.has(font.family)) {
      injectGoogleFontLink(font.family);
      injectedRef.current.add(font.family);
    }
  }, []);

  const handleAdd = useCallback(async () => {
    if (!selected) {
      return;
    }
    setAddState("loading");
    setAddError("");
    try {
      const descriptors = await fetchGoogleFontDescriptors(selected.family);
      const source = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
        selected.family,
      )}&display=swap`;
      const entry: CustomFontEntry = {
        id: familyToId(selected.family),
        family: selected.family,
        source,
        type: "google",
        metrics: DEFAULT_CUSTOM_FONT_METRICS,
        descriptors,
      };
      onFontAdded(entry);
      onClose();
    } catch (err) {
      setAddState("error");
      setAddError(
        err instanceof Error ? err.message : "Failed to add font",
      );
    }
  }, [selected, onFontAdded, onClose]);

  return (
    <div className="custom-font-dialog__panel">
      {/* Search + category filter */}
      <div className="custom-font-dialog__toolbar">
        <input
          className="custom-font-dialog__input custom-font-dialog__search"
          type="search"
          placeholder="Search fonts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <select
          className="custom-font-dialog__select"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
      </div>

      {/* Font list + preview pane */}
      <div className="custom-font-dialog__browser">
        {/* Left: scrollable font list */}
        <div className="custom-font-dialog__font-list">
          {filtered.length === 0 && (
            <p className="custom-font-dialog__loading-msg">No fonts found.</p>
          )}
          {filtered.map((font) => (
            <FontListItem
              key={font.family}
              font={font}
              isSelected={selected?.family === font.family}
              onSelect={handleSelect}
              injectedRef={injectedRef}
            />
          ))}
        </div>

        {/* Right: preview pane */}
        <div className="custom-font-dialog__preview-pane">
          {selected ? (
            <>
              <div className="custom-font-dialog__preview-name">
                {selected.family}
              </div>
              <div
                className="custom-font-dialog__preview-sample"
                style={{ fontFamily: `"${selected.family}", sans-serif` }}
              >
                The quick brown fox jumps over the lazy dog
              </div>
              <div
                className="custom-font-dialog__preview-sample custom-font-dialog__preview-sample--lg"
                style={{ fontFamily: `"${selected.family}", sans-serif` }}
              >
                Aa Bb Cc 0 1 2
              </div>
              {addState === "error" && (
                <p className="custom-font-dialog__error">{addError}</p>
              )}
              <button
                type="button"
                className="custom-font-dialog__btn custom-font-dialog__btn--primary custom-font-dialog__btn--full"
                onClick={handleAdd}
                disabled={addState === "loading"}
              >
                {addState === "loading" ? "Adding…" : `Add "${selected.family}"`}
              </button>
            </>
          ) : (
            <p className="custom-font-dialog__preview-hint">
              ← Select a font to preview it
            </p>
          )}
        </div>
      </div>

      <div className="custom-font-dialog__footer">
        {filtered.length > 0 && (
          <span className="custom-font-dialog__count">
            {filtered.length} font{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
};

// Separate component so we can use IntersectionObserver per item
const FontListItem = React.memo(
  ({
    font,
    isSelected,
    onSelect,
    injectedRef,
  }: {
    font: GFontMeta;
    isSelected: boolean;
    onSelect: (f: GFontMeta) => void;
    injectedRef: React.MutableRefObject<Set<string>>;
  }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      if (!ref.current) {
        return;
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (!injectedRef.current.has(font.family)) {
              injectGoogleFontLink(font.family);
              injectedRef.current.add(font.family);
            }
            observer.disconnect();
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    }, [font.family, injectedRef]);

    return (
      <button
        ref={ref}
        type="button"
        className={`custom-font-dialog__font-item${
          isSelected ? " custom-font-dialog__font-item--selected" : ""
        }`}
        onClick={() => onSelect(font)}
        title={font.family}
      >
        <span className="custom-font-dialog__font-item-name">
          {font.family}
        </span>
        {visible && (
          <span
            className="custom-font-dialog__font-item-preview"
            style={{ fontFamily: `"${font.family}", sans-serif` }}
          >
            {PREVIEW_TEXT}
          </span>
        )}
      </button>
    );
  },
);
FontListItem.displayName = "FontListItem";

// ---------------------------------------------------------------------------
// Custom (upload) panel
// ---------------------------------------------------------------------------

interface CustomFontPanelProps {
  onFontAdded: (entry: CustomFontEntry) => void;
  onClose: () => void;
}

const CustomFontPanel = ({ onFontAdded, onClose }: CustomFontPanelProps) => {
  const [customFontName, setCustomFontName] = useState("");
  const [customFontDataUrl, setCustomFontDataUrl] = useState<string | null>(
    null,
  );
  const [customFileName, setCustomFileName] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      setCustomFileName(file.name);
      const guessedName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ");
      if (!customFontName) {
        setCustomFontName(guessedName);
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCustomFontDataUrl(reader.result as string);
        setError("");
      };
      reader.onerror = () => setError("Failed to read font file");
      reader.readAsDataURL(file);
    },
    [customFontName],
  );

  const handleAdd = useCallback(() => {
    const family = customFontName.trim();
    if (!family || !customFontDataUrl) {
      setError("Please select a font file and enter a family name.");
      return;
    }
    const entry: CustomFontEntry = {
      id: familyToId(family),
      family,
      source: customFontDataUrl,
      type: "custom",
      metrics: DEFAULT_CUSTOM_FONT_METRICS,
      descriptors: [{ uri: customFontDataUrl }],
    };
    onFontAdded(entry);
    onClose();
  }, [customFontName, customFontDataUrl, onFontAdded, onClose]);

  return (
    <div className="custom-font-dialog__panel">
      <p className="custom-font-dialog__hint">
        {t("customFontDialog.customHint")}
      </p>

      <div className="custom-font-dialog__row">
        <button
          type="button"
          className="custom-font-dialog__btn"
          onClick={() => fileInputRef.current?.click()}
        >
          {customFileName ? customFileName : t("customFontDialog.chooseFile")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      <div className="custom-font-dialog__row">
        <input
          className="custom-font-dialog__input"
          type="text"
          placeholder={t("customFontDialog.familyPlaceholder")}
          value={customFontName}
          onChange={(e) => setCustomFontName(e.target.value)}
        />
      </div>

      {customFontDataUrl && customFontName && (
        <p
          className="custom-font-dialog__preview-sample"
          style={{ fontFamily: `"${customFontName}", sans-serif` }}
        >
          The quick brown fox jumps over the lazy dog
        </p>
      )}

      {error && <p className="custom-font-dialog__error">{error}</p>}

      <div className="custom-font-dialog__actions">
        <button
          type="button"
          className="custom-font-dialog__btn custom-font-dialog__btn--primary"
          disabled={!customFontDataUrl || !customFontName.trim()}
          onClick={handleAdd}
        >
          {t("customFontDialog.addFont")}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export interface CustomFontDialogProps {
  onClose: () => void;
  onFontAdded: (entry: CustomFontEntry) => void;
}

export const CustomFontDialog = ({
  onClose,
  onFontAdded,
}: CustomFontDialogProps) => {
  const [activeTab, setActiveTab] = useState<"google" | "custom">("google");

  return (
    <Dialog
      title={t("customFontDialog.title")}
      onCloseRequest={onClose}
      size="wide"
    >
      <div className="custom-font-dialog">
        <div className="custom-font-dialog__tabs">
          <TabButton
            active={activeTab === "google"}
            onClick={() => setActiveTab("google")}
          >
            {t("customFontDialog.googleTab")}
          </TabButton>
          <TabButton
            active={activeTab === "custom"}
            onClick={() => setActiveTab("custom")}
          >
            {t("customFontDialog.customTab")}
          </TabButton>
        </div>

        {activeTab === "google" ? (
          <GoogleFontsPanel onFontAdded={onFontAdded} onClose={onClose} />
        ) : (
          <CustomFontPanel onFontAdded={onFontAdded} onClose={onClose} />
        )}
      </div>
    </Dialog>
  );
};
