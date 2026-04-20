import { useState, useEffect, useCallback, useRef } from "react";

// ── Notification types ────────────────────────────────────
const CATEGORIES = {
  price:       { label: "Prix Token",     color: "#f59e0b", darkBg: "bg-accent/10",      border: "border-accent/30"      },
  dao:         { label: "DAO Gouvernance",color: "#3b82f6", darkBg: "bg-primary/10",     border: "border-primary/30"     },
  audit:       { label: "Audit IA",       color: "#ef4444", darkBg: "bg-red-500/10",     border: "border-red-500/30"     },
  staking:     { label: "Staking",        color: "#10b981", darkBg: "bg-green-500/10",   border: "border-green-500/30"   },
  liquidity:   { label: "Liquidité",      color: "#8b5cf6", darkBg: "bg-chart-4/10",     border: "border-chart-4/30"     },
  security:    { label: "Sécurité",       color: "#ef4444", darkBg: "bg-red-500/10",     border: "border-red-500/30"     },
};

// ── Simulated event pool ──────────────────────────────────
const EVENT_POOL = [
  { category: "price",     severity: "critical", title: "Chute brutale du prix AQ",       body: "Le token AQ a perdu −12.4% en 15 minutes. Prix actuel : $7.42. Seuil d'alerte franchi." },
  { category: "price",     severity: "warning",  title: "AQ dépasse $9.00",               body: "Le token AQ vient de franchir le seuil de $9.00 (+6.2%). Nouveau ATH en cours." },
  { category: "dao",       severity: "info",     title: "Proposition AIP-47 adoptée",      body: "La proposition de réduction du burn rate à 1.2% a été validée (68% pour, quorum atteint)." },
  { category: "dao",       severity: "warning",  title: "Vote critique en cours",          body: "AIP-52 : Modification du taux d'inflation. Il reste 2h pour voter. Votre voix compte." },
  { category: "audit",     severity: "critical", title: "Vulnérabilité CRITIQUE détectée", body: "TokenVault.sol : Reentrancy guard manquant sur withdraw(). Correctif requis immédiatement." },
  { category: "audit",     severity: "warning",  title: "Alerte access control",           body: "GovernanceCore.sol L.142 : fonction setInflationRate() sans vérification de rôle." },
  { category: "staking",   severity: "info",     title: "Récompenses distribuées",         body: "+2,680 AQ crédités sur votre stake Gold. APY effectif : 45.2% cette semaine." },
  { category: "liquidity", severity: "info",     title: "Position LP en déséquilibre",     body: "Votre pool AQ/ETH présente un déséquilibre de 18%. Perte impermanente estimée : −$142." },
  { category: "security",  severity: "critical", title: "Attaque Shor détectée",          body: "Tentative d'attaque quantique sur ECDSA-256 (GovernanceCore). Migration Dilithium recommandée." },
  { category: "price",     severity: "info",     title: "Volume 24h record",               body: "Volume de trading AQ : $9.8M en 24h (+34%). Liquidité en hausse sur toutes les paires." },
];

let idCounter = 1;

function makeNotif(event) {
  return {
    id: idCounter++,
    ...event,
    ts: new Date(),
    read: false,
  };
}

// ── Seed initial notifications ────────────────────────────
const INITIAL = [
  makeNotif(EVENT_POOL[4]),  // critical audit
  makeNotif(EVENT_POOL[3]),  // dao vote
  makeNotif(EVENT_POOL[0]),  // price drop
  makeNotif(EVENT_POOL[6]),  // staking rewards
  makeNotif(EVENT_POOL[8]),  // quantum attack
];

// ── Hook ──────────────────────────────────────────────────
export function useNotifications() {
  const [notifications, setNotifications] = useState(INITIAL);
  const indexRef = useRef(1);

  // Simulate incoming events every 15–30s
  useEffect(() => {
    const fire = () => {
      const idx = (indexRef.current + Math.floor(Math.random() * 3) + 1) % EVENT_POOL.length;
      indexRef.current = idx;
      setNotifications(prev => [makeNotif(EVENT_POOL[idx]), ...prev].slice(0, 50));
    };

    const schedule = () => {
      const delay = 15000 + Math.random() * 20000;
      return setTimeout(() => { fire(); timeoutRef.current = schedule(); }, delay);
    };

    const timeoutRef = { current: schedule() };
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const markRead    = useCallback((id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const markAllRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);
  const dismiss     = useCallback((id) => setNotifications(prev => prev.filter(n => n.id !== id)), []);
  const clearAll    = useCallback(() => setNotifications([]), []);

  const unread = notifications.filter(n => !n.read).length;

  return { notifications, unread, markRead, markAllRead, dismiss, clearAll, CATEGORIES };
}

export { CATEGORIES };