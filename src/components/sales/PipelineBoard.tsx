"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { Check, MoreHorizontal, ThumbsDown, Trophy } from "lucide-react";
import type { PipelineView } from "@/lib/sales/service";
import { ToastProvider, formatMoney, post, useFormat, useToast, type Locale } from "./shared";

type Props = { view: PipelineView; locale: Locale; currency: string; staleDays: number };
type Stage = NonNullable<PipelineView["active"]>["stages"][number];
type Deal = Stage["deals"][number];

const WON = "outcome:won";
const LOST = "outcome:lost";

export function PipelineBoard(props: Props) {
  return (
    <ToastProvider>
      <Board {...props} />
    </ToastProvider>
  );
}

/** Opportunity-Namen enthalten in GHL oft „Name-+49 …“. Die Telefonnummer gehört nicht auf die Karte. */
function cleanName(name: string): string {
  return name.replace(/\s*[-–]?\s*\+?\d[\d\s/()-]{6,}$/, "").trim();
}

function Board({ view, locale, currency, staleDays }: Props) {
  const t = useTranslations("sales.pipeline");
  const router = useRouter();
  const toast = useToast();
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  if (!view.active) return <p className="sl-empty">{t("empty")}</p>;
  const active = view.active;

  const all: Deal[] = active.stages.flatMap((s) => s.deals).filter((d) => !closed.has(d.id));
  const stageOf = (d: Deal) => moved[d.id] ?? d.stageId;
  const total = all.reduce((s, d) => s + (d.value ?? 0), 0);
  const stageName = (id: string) => active.stages.find((s) => s.id === id)?.name ?? "";

  const reopen = (id: string) =>
    setClosed((c) => {
      const n = new Set(c);
      n.delete(id);
      return n;
    });

  const move = async (deal: Deal, stageId: string) => {
    const before = stageOf(deal);
    if (before === stageId) return;
    setMoved((m) => ({ ...m, [deal.id]: stageId }));
    const { ok } = await post(`/api/sales/opportunities/${encodeURIComponent(deal.id)}`, { stageId });
    if (!ok) {
      setMoved((m) => ({ ...m, [deal.id]: before }));
      toast({ text: t("failed"), tone: "error" });
      return;
    }
    toast({
      text: t("moved", { stage: stageName(stageId) }),
      tone: "ok",
      action: {
        label: t("undo"),
        run: async () => {
          const res = await post(`/api/sales/opportunities/${encodeURIComponent(deal.id)}`, { stageId: before });
          if (res.ok) setMoved((m) => ({ ...m, [deal.id]: before }));
        }
      }
    });
  };

  const close = async (deal: Deal, status: "won" | "lost") => {
    setClosed((c) => new Set(c).add(deal.id));
    const { ok } = await post(`/api/sales/opportunities/${encodeURIComponent(deal.id)}`, { status });
    if (!ok) {
      reopen(deal.id);
      toast({ text: t("failed"), tone: "error" });
      return;
    }
    toast({
      text: status === "won" ? t("wonToast") : t("lostToast"),
      tone: "ok",
      action: {
        label: t("undo"),
        run: async () => {
          const res = await post(`/api/sales/opportunities/${encodeURIComponent(deal.id)}`, { status: "open" });
          if (res.ok) reopen(deal.id);
        }
      }
    });
  };

  const onDragStart = (e: DragStartEvent) => setDragging(all.find((d) => d.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const deal = all.find((d) => d.id === e.active.id);
    const target = e.over?.id ? String(e.over.id) : null;
    if (!deal || !target) return;
    if (target === WON) void close(deal, "won");
    else if (target === LOST) void close(deal, "lost");
    else void move(deal, target);
  };

  return (
    <div className="sl-pipeline">
      <header className="sl-pipeline-head">
        <div>
          <h1>{active.name}</h1>
          <p className="sl-hero-line">{t("summary", { count: all.length, value: formatMoney(total, currency, locale) })}</p>
        </div>
        {view.pipelines.length > 1 && (
          <nav className="chips" aria-label={t("choose")}>
            {view.pipelines.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                aria-pressed={p.id === active.id}
                onClick={() => router.push(`/sales/pipeline?p=${encodeURIComponent(p.id)}`)}
              >
                {p.name}
                <span className="sl-chip-count">{p.count}</span>
              </button>
            ))}
          </nav>
        )}
      </header>
      <p className="sl-board-hint">{t("dragHint")}</p>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        // Nur ganz am Rand und gemächlich scrollen, sonst läuft die Ziel-Spalte unter dem Zeiger weg
        autoScroll={{ threshold: { x: 0.06, y: 0.12 }, acceleration: 4 }}
        accessibility={{
          screenReaderInstructions: { draggable: t("a11y.instructions") }
        }}
      >
        <div className={dragging ? "sl-board is-dragging" : "sl-board"}>
          {active.stages.map((stage) => {
            const deals = all.filter((d) => stageOf(d) === stage.id);
            return (
              <Column
                key={stage.id}
                stage={stage}
                deals={deals}
                currency={currency}
                locale={locale}
                staleDays={staleDays}
                stages={active.stages}
                draggingId={dragging?.id ?? null}
                onMove={move}
                onClose={close}
              />
            );
          })}
        </div>

        {dragging && (
          <div className="sl-outcome-bar">
            <OutcomeZone id={WON} label={t("dropWon")} icon={<Trophy size={18} aria-hidden="true" />} />
            <OutcomeZone id={LOST} label={t("dropLost")} icon={<ThumbsDown size={18} aria-hidden="true" />} />
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {dragging ? <CardBody deal={dragging} currency={currency} locale={locale} staleDays={staleDays} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  stage,
  deals,
  currency,
  locale,
  staleDays,
  stages,
  draggingId,
  onMove,
  onClose
}: {
  stage: Stage;
  deals: Deal[];
  currency: string;
  locale: Locale;
  staleDays: number;
  stages: Stage[];
  draggingId: string | null;
  onMove: (deal: Deal, stageId: string) => void;
  onClose: (deal: Deal, status: "won" | "lost") => void;
}) {
  const t = useTranslations("sales.pipeline");
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const sum = deals.reduce((s, d) => s + (d.value ?? 0), 0);
  const empty = deals.length === 0;
  const cls = ["sl-stage", empty ? "is-empty" : "", isOver ? "is-over" : ""].filter(Boolean).join(" ");

  return (
    <section ref={setNodeRef} className={cls} aria-label={`${stage.name}, ${deals.length}`}>
      <header className="sl-stage-head">
        <h2 title={stage.name}>{stage.name}</h2>
        <span className="sl-stage-count">{deals.length}</span>
        {sum > 0 && <span className="sl-stage-sum">{formatMoney(sum, currency, locale)}</span>}
      </header>
      {empty ? (
        <p className="sl-stage-empty">{t("stageEmpty")}</p>
      ) : (
        <ul className="sl-deals">
          {deals.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              currency={currency}
              locale={locale}
              staleDays={staleDays}
              stages={stages}
              currentStage={stage.id}
              hidden={draggingId === d.id}
              onMove={onMove}
              onClose={onClose}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DealCard({
  deal,
  currency,
  locale,
  staleDays,
  stages,
  currentStage,
  hidden,
  onMove,
  onClose
}: {
  currentStage: string;
  deal: Deal;
  currency: string;
  locale: Locale;
  staleDays: number;
  stages: Stage[];
  hidden: boolean;
  onMove: (deal: Deal, stageId: string) => void;
  onClose: (deal: Deal, status: "won" | "lost") => void;
}) {
  const t = useTranslations("sales.pipeline");
  const { attributes, listeners, setNodeRef } = useDraggable({ id: deal.id });
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <li ref={setNodeRef} className={["sl-deal", deal.stale ? "is-stale" : "", hidden ? "is-ghost" : ""].filter(Boolean).join(" ")} {...attributes} {...listeners}>
      <CardBody deal={deal} currency={currency} locale={locale} staleDays={staleDays} />
      <div className="sl-deal-menu" ref={menuRef}>
        <button
          type="button"
          className="sl-icon-button sl-deal-more"
          aria-label={t("actions", { name: cleanName(deal.company || deal.contactName || deal.name) })}
          aria-expanded={menu}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={() => setMenu((m) => !m)}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
        {menu && (
          <div className="sl-menu" role="menu" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <p className="sl-menu-label">{t("moveTo")}</p>
            {stages.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={s.id === currentStage}
                onClick={() => {
                  setMenu(false);
                  onMove(deal, s.id);
                }}
              >
                <span className="sl-menu-check">{s.id === currentStage && <Check size={14} aria-hidden="true" />}</span>
                {s.name}
              </button>
            ))}
            <hr />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                onClose(deal, "won");
              }}
            >
              <Trophy size={14} aria-hidden="true" />
              {t("won")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                onClose(deal, "lost");
              }}
            >
              <ThumbsDown size={14} aria-hidden="true" />
              {t("lost")}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function CardBody({ deal, currency, locale, staleDays, overlay = false }: { deal: Deal; currency: string; locale: Locale; staleDays: number; overlay?: boolean }) {
  const t = useTranslations("sales.pipeline");
  const f = useFormat(locale);
  const title = cleanName(deal.company || deal.contactName || deal.name);
  const person = deal.contactName && deal.contactName.toLowerCase() !== title.toLowerCase() ? deal.contactName : "";
  const content = (
    <>
      <strong>{title}</strong>
      {person && <span className="sl-deal-person">{person}</span>}
      <span className="sl-deal-meta">
        {deal.value != null && deal.value > 0 && <span className="sl-deal-value">{formatMoney(deal.value, currency, locale)}</span>}
        {deal.lastActivity && (
          <span className={deal.stale ? "sl-stale" : "sl-deal-age"} title={deal.stale ? t("staleHint", { days: staleDays }) : undefined}>
            {f.relativeDay(deal.lastActivity)}
          </span>
        )}
      </span>
    </>
  );
  if (overlay) return <div className={deal.stale ? "sl-deal is-stale is-overlay" : "sl-deal is-overlay"}>{content}</div>;
  return deal.contactId ? (
    <a className="sl-deal-main" href={`/sales/kontakt/${deal.contactId}`} draggable={false}>
      {content}
    </a>
  ) : (
    <div className="sl-deal-main">{content}</div>
  );
}

function OutcomeZone({ id, label, icon }: { id: string; label: string; icon: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={[`sl-outcome sl-outcome-${id.split(":")[1]}`, isOver ? "is-over" : ""].join(" ")}>
      {icon}
      {label}
    </div>
  );
}
