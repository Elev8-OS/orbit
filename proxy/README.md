# Auth-Proxy für Tools ohne Microsoft-Login

Tools, die heute ungeschützt sind oder eigene Passwörter verwenden, bekommen einen
vorgeschalteten [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/). Der Proxy erzwingt
den Entra-Login und prüft die App Role, **bevor** eine Anfrage das Tool erreicht. Am Tool selbst
musst du nichts ändern.

```
Browser ──► reports-auth.example.com (oauth2-proxy, öffentlich)
                 │  Login + Rollenprüfung
                 ▼
            legacy-reports.railway.internal:8080 (Tool, NICHT öffentlich)
```

## Einrichtung auf Railway

1. **Tool absichern:** Beim bestehenden Tool-Service unter *Settings → Networking* die öffentliche
   Domain entfernen. Das Tool ist dann nur noch im privaten Railway-Netzwerk erreichbar. Notiere
   den internen Namen (z.B. `legacy-reports.railway.internal`) und den Port.
2. **Proxy-Service anlegen:** *New → Docker Image* → `quay.io/oauth2-proxy/oauth2-proxy:<version>`.
   Die Variablen aus `oauth2-proxy.env.example` übernehmen und anpassen.
3. **Domain:** Dem Proxy eine öffentliche Domain geben (Target-Port `4180`), z.B.
   `reports-auth.example.com`.
4. **Entra:** In der Orbit-App-Registrierung unter *Authentication* die Redirect-URI
   `https://reports-auth.example.com/oauth2/callback` ergänzen. Proxy und Orbit teilen sich so
   dieselben App Roles.
5. **Orbit:** In `config/apps.yaml` als `url` die Proxy-Domain eintragen.

## Gut zu wissen

- Pro Legacy-Tool ein eigener Proxy-Service. Das hält die Rollenprüfung pro Tool sauber getrennt.
- `OAUTH2_PROXY_ALLOWED_GROUPS` muss dieselben Rollen enthalten wie `roles` in `apps.yaml`,
  plus `Orbit.Admin`, falls Admins Zugriff haben sollen.
- Das Tool bekommt Name und E-Mail des Users als Header. Hat das Tool noch einen eigenen Login,
  bleibt dieser zusätzlich bestehen, bis du ihn ausbaust (Phase 2).
- Tools, die bereits nativ per Microsoft anmelden, brauchen keinen Proxy. Sie sollten aber
  die Rolle selbst prüfen, nicht nur den Login.
