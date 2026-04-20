import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, Check, AlertTriangle, Copy, Loader2, Save, Trash2 } from "lucide-react";

export default function TelegramAlertsSettings() {
  const [user, setUser] = useState(null);
  const [upperThreshold, setUpperThreshold] = useState("");
  const [lowerThreshold, setLowerThreshold] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
  }, []);

  const { data: existingAlert, isLoading } = useQuery({
    queryKey: ["userPriceAlert", user?.email],
    queryFn: () => user?.email 
      ? base44.entities.UserPriceAlert.filter({ user_email: user.email })
      : Promise.resolve([]),
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (existingAlert?.length > 0) {
      const alert = existingAlert[0];
      setUpperThreshold(alert.upper_threshold || "");
      setLowerThreshold(alert.lower_threshold || "");
      setTelegramChatId(alert.telegram_chat_id || "");
      setCooldownMinutes(alert.alert_cooldown_minutes || 60);
      setAlertEnabled(alert.enabled !== false);
    }
  }, [existingAlert]);

  const handleSave = async () => {
    if (!user?.email || !telegramChatId) return;
    
    setSaving(true);
    try {
      const data = {
        user_email: user.email,
        telegram_chat_id: telegramChatId,
        upper_threshold: parseFloat(upperThreshold) || null,
        lower_threshold: parseFloat(lowerThreshold) || null,
        enabled: alertEnabled,
        alert_cooldown_minutes: cooldownMinutes,
      };

      if (existingAlert?.length > 0) {
        await base44.entities.UserPriceAlert.update(existingAlert[0].id, data);
      } else {
        await base44.entities.UserPriceAlert.create(data);
      }
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!existingAlert?.length) return;
    setSaving(true);
    try {
      await base44.entities.UserPriceAlert.delete(existingAlert[0].id);
      setUpperThreshold("");
      setLowerThreshold("");
      setTelegramChatId("");
    } catch (err) {
      console.error("Erreur suppression:", err);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Alertes Prix AQ via Telegram</h2>
        <p className="text-sm text-muted-foreground mt-1">Configurez vos seuils de prix pour recevoir des notifications instantanées</p>
      </div>

      {/* Status card */}
      <div className={cn("rounded-xl p-5 border", alertEnabled ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className={cn("h-5 w-5", alertEnabled ? "text-green-400" : "text-red-400")} />
            <div>
              <p className="text-sm font-bold text-foreground">Statut des Alertes</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {alertEnabled ? "Alertes activées" : "Alertes désactivées"}
              </p>
            </div>
          </div>
          <Badge className={cn("text-[10px]", alertEnabled ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
            {alertEnabled ? "🟢 Actif" : "🔴 Inactif"}
          </Badge>
        </div>
      </div>

      {/* Setup form */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-bold text-foreground">Configuration Telegram</h3>

        {/* Telegram setup instruction */}
        <div className="bg-secondary/30 rounded-lg p-4 space-y-3 border border-border/50">
          <p className="text-xs font-semibold text-foreground">📱 Comment activer les notifications?</p>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Ouvrez Telegram et cherchez le bot: <code className="text-accent font-mono">@AEGISAlertsBot</code></li>
            <li>Tapez <code className="text-accent font-mono">/start</code> pour initialiser le bot</li>
            <li>Copiez votre Chat ID (affiché par le bot)</li>
            <li>Collez le Chat ID ci-dessous</li>
          </ol>
        </div>

        {/* Chat ID input */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Chat ID Telegram</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ex: 123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(telegramChatId);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-px bg-border" />

        <h3 className="text-sm font-bold text-foreground">Seuils d'Alerte (USD)</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Upper threshold */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Seuil Supérieur
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Ex: 2.50"
                value={upperThreshold}
                onChange={(e) => setUpperThreshold(e.target.value)}
                step="0.01"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-xs text-muted-foreground">USD</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Alerte quand AQ dépasse ce prix</p>
          </div>

          {/* Lower threshold */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Seuil Inférieur
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Ex: 1.80"
                value={lowerThreshold}
                onChange={(e) => setLowerThreshold(e.target.value)}
                step="0.01"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-xs text-muted-foreground">USD</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Alerte quand AQ chute sous ce prix</p>
          </div>
        </div>

        {/* Cooldown */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Délai minimal entre alertes</label>
          <select
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(parseInt(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 heure</option>
            <option value={120}>2 heures</option>
            <option value={240}>4 heures</option>
          </select>
          <p className="text-[10px] text-muted-foreground">Évite les alertes répétitives pour le même seuil</p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center gap-3 bg-secondary/40 rounded-lg p-4">
          <input
            type="checkbox"
            id="alertEnabled"
            checked={alertEnabled}
            onChange={(e) => setAlertEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <label htmlFor="alertEnabled" className="text-sm text-foreground font-medium cursor-pointer flex-1">
            Activer les notifications
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving || !telegramChatId} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {existingAlert?.length > 0 ? "Mettre à jour" : "Créer les alertes"}
          </Button>
          {existingAlert?.length > 0 && (
            <Button variant="outline" onClick={handleDelete} disabled={saving} className="gap-2 text-red-400 border-red-500/30 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">ℹ️ Informations importantes</p>
            <p>• Les alertes sont vérifiées toutes les heures</p>
            <p>• Vous recevrez une notification Telegram instantanée quand un seuil est franchi</p>
            <p>• Le Chat ID est stocké sécurisé et lié à votre compte</p>
          </div>
        </div>
      </div>
    </div>
  );
}