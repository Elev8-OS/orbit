/** Startet beim Serverstart die Hintergrundaufgaben (Statusprüfung, E-Mail-Assistent). Nur in der Node-Laufzeit. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
