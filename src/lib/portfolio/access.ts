import { isAdmin } from "@/lib/apps";

/**
 * Rollen des Portfolio-Moduls (/portfolio). Über Umgebungsvariablen änderbar (kommagetrennt).
 * - PORTFOLIO_ROLES: ansehen (Standard App.PortfolioCH und App.PortfolioCH.Edit)
 * - PORTFOLIO_EDIT_ROLES: Kosten, Gemeinkosten und Ziele pflegen, Neubeurteilung anstossen (Standard App.PortfolioCH.Edit)
 * - Orbit.Admin darf immer alles.
 */
const list = (name: string, fallback: string) =>
  (process.env[name] || fallback)
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

export const PORTFOLIO_ROLES = () => list("PORTFOLIO_ROLES", "App.PortfolioCH,App.PortfolioCH.Edit");
export const PORTFOLIO_EDIT_ROLES = () => list("PORTFOLIO_EDIT_ROLES", "App.PortfolioCH.Edit");

export const hasPortfolioAccess = (roles: string[]) => isAdmin(roles) || roles.some((r) => PORTFOLIO_ROLES().includes(r));
export const canEditPortfolio = (roles: string[]) => isAdmin(roles) || roles.some((r) => PORTFOLIO_EDIT_ROLES().includes(r));
