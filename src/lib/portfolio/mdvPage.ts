/** Kleine Ergebnisseite für das Anmeldefenster: meldet das Ergebnis an das Portfolio-Modul und schliesst sich. */
export function resultPage(ok: boolean, message: string) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const payload = JSON.stringify({ type: "orbit-mdv", ok }).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>myDataValue</title>
<style>body{font-family:system-ui,sans-serif;background:#0e0e0e;color:#f4efe8;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:420px;padding:24px;text-align:center}h1{font-size:18px;color:${ok ? "#cca67d" : "#e5806b"}}p{opacity:.85;line-height:1.5}</style></head>
<body><main><h1>${ok ? "myDataValue verbunden" : "Verbindung fehlgeschlagen"}</h1><p>${esc(message)}</p><p>Dieses Fenster kann geschlossen werden.</p></main>
<script>try{if(window.opener){window.opener.postMessage(${payload},location.origin);setTimeout(()=>window.close(),${ok ? 1500 : 6000});}}catch(e){}</script></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
