"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { RotateCcw, Search, X } from "lucide-react";
import { AppTile } from "./AppTile";
import { AccessRequestDialog, type RequestableApp } from "./AccessRequestDialog";
import { REVEAL_EVENT } from "./WelcomeIntro";

export type TileData = {
  id: string;
  name: string;
  description: string;
  url: string;
  openIn: "newTab" | "sameTab";
  categoryId: string;
  categoryName: string;
  color: string;
  icon: ReactNode;
  isNew: boolean;
  /** öffnet als Tab innerhalb von Orbit */
  embed: boolean;
};

export type CategoryData = { id: string; name: string; color: string };

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  tiles: TileData[];
  categories: CategoryData[];
  defaultOrder: string[];
  supportEmail: string | null;
  requestable: RequestableApp[];
  pendingRequests: string[];
  /** true direkt nach dem Login: Kacheln warten auf die Begrüssung und fliegen dann ein */
  welcome: boolean;
};

async function putOrder(order: string[]) {
  const res = await fetch("/api/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function Dashboard({ tiles, categories, defaultOrder, supportEmail, requestable, pendingRequests, welcome }: Props) {
  const t = useTranslations("dashboard");
  const tDnd = useTranslations("dnd");

  const byId = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles]);
  const [order, setOrder] = useState(() => tiles.map((tile) => tile.id));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [badges, setBadges] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const saveSeq = useRef(0);
  const [revealed, setRevealed] = useState(!welcome);

  // Nach der Begrüssung einblenden (mit Sicherheitsnetz, falls das Event ausbleibt)
  useEffect(() => {
    if (revealed) return;
    const show = () => setRevealed(true);
    window.addEventListener(REVEAL_EVENT, show);
    const fallback = window.setTimeout(show, 6000);
    return () => {
      window.removeEventListener(REVEAL_EVENT, show);
      window.clearTimeout(fallback);
    };
  }, [revealed]);

  // Gelbe Punkte mit Zahlen (ungelesen/unbearbeitet pro App): beim Laden, jede Minute und wenn man zurückkommt
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/badges", { cache: "no-store" });
        if (res.ok && alive) setBadges((await res.json()) as Record<string, number>);
      } catch {
        /* ohne Zahlen bleibt die Startseite wie bisher */
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Wenn der Server neue Tiles liefert (z.B. nach Sprachwechsel), Reihenfolge übernehmen
  useEffect(() => setOrder(tiles.map((tile) => tile.id)), [tiles]);

  const persist = useCallback(async (next: string[]) => {
    const seq = ++saveSeq.current;
    setSaveState("saving");
    try {
      await putOrder(next);
      if (seq === saveSeq.current) setSaveState("saved");
    } catch {
      if (seq === saveSeq.current) setSaveState("error");
    }
  }, []);

  // Neu freigeschaltete Apps einmal als "gesehen" speichern – das Badge erscheint so nur bei diesem Besuch
  useEffect(() => {
    if (tiles.some((tile) => tile.isNew)) putOrder(tiles.map((tile) => tile.id)).catch(() => {});
  }, [tiles]);

  // "/" fokussiert die Suche, Escape in der Suche leert sie
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && target === searchRef.current) {
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const needle = query.trim().toLocaleLowerCase();
  const filtering = needle.length > 0 || category !== null;
  const shown = order
    .map((id) => byId.get(id))
    .filter((tile): tile is TileData => Boolean(tile))
    .filter((tile) => !category || tile.categoryId === category)
    .filter(
      (tile) =>
        !needle || `${tile.name} ${tile.description} ${tile.categoryName}`.toLocaleLowerCase().includes(needle)
    );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(order, from, to);
    setOrder(next);
    void persist(next);
  };

  const resetOrder = () => {
    const known = new Set(order);
    const next = [...defaultOrder.filter((id) => known.has(id)), ...order.filter((id) => !defaultOrder.includes(id))];
    setOrder(next);
    void persist(next);
  };

  const nameOf = (id: UniqueIdentifier) => byId.get(String(id))?.name ?? "";
  const positionOf = (id: UniqueIdentifier) => order.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => tDnd("pickedUp", { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? tDnd("movedOver", { name: nameOf(active.id), position: positionOf(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? tDnd("dropped", { name: nameOf(active.id), position: positionOf(over.id) }) : tDnd("cancelled"),
    onDragCancel: () => tDnd("cancelled")
  };

  if (tiles.length === 0) {
    return (
      <section className="empty">
        <h2>{t("emptyTitle")}</h2>
        <p>{t("emptyBody")}</p>
        {requestable.length > 0 ? (
          <AccessRequestDialog apps={requestable} initialPending={pendingRequests} variant="primary" />
        ) : (
          supportEmail && (
            <a className="button-secondary" href={`mailto:${supportEmail}`}>
              {t("contact")}
            </a>
          )
        )}
      </section>
    );
  }

  const tileLabels = (tile: TileData) => ({
    new: t("new"),
    opensNewTab: t("opensNewTab"),
    dragHandle: t("dragHandle", { name: tile.name })
  });

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Search className="search-icon" size={18} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            aria-describedby="search-hint"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label={t("clearSearch")}>
              <X size={16} aria-hidden="true" />
            </button>
          ) : (
            <kbd className="search-kbd" aria-hidden="true">
              /
            </kbd>
          )}
          <span id="search-hint" className="sr-only">
            {t("searchHint")}
          </span>
        </div>

        {categories.length > 1 && (
          <div className="chips" role="group" aria-label={t("categories")}>
            <button type="button" className="chip" aria-pressed={category === null} onClick={() => setCategory(null)}>
              {t("allCategories")}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={category === c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
                style={{ "--chip-color": c.color } as CSSProperties}
              >
                <span className="chip-dot" aria-hidden="true" />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="status-row">
        <p className="status-hint">{filtering ? t("dragPaused") : t("dragHint")}</p>
        <div className="status-actions">
          <p className={`save-state save-${saveState}`} role="status" aria-live="polite">
            {saveState === "saving" && t("saving")}
            {saveState === "saved" && t("saved")}
            {saveState === "error" && t("saveError")}
          </p>
          {!filtering && (
            <button type="button" className="button-ghost" onClick={resetOrder}>
              <RotateCcw size={15} aria-hidden="true" />
              {t("reset")}
            </button>
          )}
          <AccessRequestDialog apps={requestable} initialPending={pendingRequests} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="no-results">
          <p>{needle ? t("noResults", { query: query.trim() }) : t("noResultsCategory")}</p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setQuery("");
              setCategory(null);
            }}
          >
            {t("clearFilters")}
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{ announcements, screenReaderInstructions: { draggable: tDnd("instructions") } }}
        >
          <SortableContext items={shown.map((tile) => tile.id)} strategy={rectSortingStrategy} disabled={filtering}>
            <ul className={`tiles${welcome ? (revealed ? " is-revealing" : " is-waiting") : ""}`}>
              {shown.map((tile, index) => (
                <AppTile key={tile.id} tile={tile} index={index} sortable={!filtering} labels={tileLabels(tile)} badge={badges[tile.id]} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}
