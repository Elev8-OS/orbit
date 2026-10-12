import { Fragment, type ReactNode } from "react";

/** Einfache, sichere Darstellung von Noahs Antworten: Absätze, Aufzählungen mit "- ", **fett**. Kein HTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  );
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "))}</p>);
    if (list.length) blocks.push(<ul key={`l${blocks.length}`}>{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
    para = [];
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (para.length) {
        const p = para;
        para = [];
        blocks.push(<p key={`p${blocks.length}`}>{inline(p.join(" "))}</p>);
      }
      list.push(bullet[1]);
    } else {
      if (list.length) {
        const l = list;
        list = [];
        blocks.push(<ul key={`l${blocks.length}`}>{l.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
      }
      para.push(line.replace(/^#+\s*/, ""));
    }
  }
  flush();
  return <div className="p-rich">{blocks}</div>;
}
