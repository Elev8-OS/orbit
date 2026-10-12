"use client";

import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, GripVertical } from "lucide-react";
import type { TileData } from "./Dashboard";

type Props = {
  tile: TileData;
  index: number;
  sortable: boolean;
  labels: { new: string; opensNewTab: string; dragHandle: string };
};

export function AppTile({ tile, index, sortable, labels }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: tile.id,
    disabled: !sortable
  });

  const newTab = tile.openIn === "newTab";
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    "--tile-color": tile.color,
    "--i": index
  } as CSSProperties;

  return (
    <li ref={setNodeRef} style={style} className={`tile${isDragging ? " is-dragging" : ""}`}>
      <a
        href={tile.url}
        className="tile-link"
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noopener noreferrer" : undefined}
      >
        <span className="tile-icon">{tile.icon}</span>
        <span className="tile-name">
          {tile.name}
          {newTab && (
            <>
              <ArrowUpRight className="tile-external" size={15} aria-hidden="true" />
              <span className="sr-only"> ({labels.opensNewTab})</span>
            </>
          )}
        </span>
        <span className="tile-description">{tile.description}</span>
        <span className="tile-category">
          <span className="tile-category-dot" aria-hidden="true" />
          {tile.categoryName}
        </span>
      </a>

      {tile.isNew && <span className="tile-badge">{labels.new}</span>}

      {sortable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="tile-handle"
          aria-label={labels.dragHandle}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
