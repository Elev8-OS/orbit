import { Elev8Logo } from "@/components/Elev8Logo";
import "./public.css";

/** Rahmen der Kundenseiten (Angebot annehmen, Onboarding): schwarzes Band mit Logo, helle Inhaltsfläche. */
export function PublicShell({
  label,
  meta,
  footer,
  children
}: {
  label: string;
  meta?: string;
  footer: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pub">
      <header className="pub-band">
        <div className="pub-band-inner">
          <Elev8Logo height={26} />
          <div className="pub-band-meta">
            <span>{label}</span>
            {meta && <strong>{meta}</strong>}
          </div>
        </div>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-footer">{footer}</footer>
    </div>
  );
}

/** Kasten "Fragen?" mit Noah per WhatsApp */
export function NoahBox({ title, text, phone, link, cta }: { title: string; text: string; phone: string; link: string; cta: string }) {
  return (
    <section className="pub-noah">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <a className="pub-wa" href={link} target="_blank" rel="noreferrer">
        <span>{cta}</span>
        <strong>{phone}</strong>
      </a>
    </section>
  );
}
