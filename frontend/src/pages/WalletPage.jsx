import { Wallet, Copy, Send, ArrowDownLeft, QrCode, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

const assets = [
  { name: "AEGIS-Q", symbol: "AQ", balance: "2,450,000", usd: "$2,058,000", change: "+3.2%" },
  { name: "Staked AQ", symbol: "sAQ", balance: "500,000", usd: "$420,000", change: "+25% APY" },
  { name: "Governance Power", symbol: "gAQ", balance: "500,000", usd: "—", change: "Active" },
];

export default function WalletPage() {
  const [showBalance, setShowBalance] = useState(true);

  const copyAddress = () => {
    navigator.clipboard.writeText("0x7a3f8B2d1C9e4A6b5D0f3E7c2B1a9d4F6e8C2d");
    toast.success("Adresse copiée");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Wallet Souverain</h2>
        <p className="text-sm text-muted-foreground mt-1">Votre coffre-fort numérique AEGIS</p>
      </div>

      {/* Wallet Card */}
      <div className="relative bg-gradient-to-br from-primary/20 via-card to-card border border-primary/20 rounded-2xl p-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-xs font-mono text-muted-foreground">Multi-Signature • Cold Storage</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowBalance(!showBalance)} className="text-muted-foreground">
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mb-1">Solde Total</p>
          <p className="text-4xl font-bold text-foreground mb-1 font-mono">
            {showBalance ? "$2,478,000" : "••••••••"}
          </p>
          <p className="text-sm text-muted-foreground font-mono">
            {showBalance ? "2,950,000 AQ" : "•••••• AQ"}
          </p>

          <div className="flex items-center gap-2 mt-6">
            <div className="flex-1 bg-secondary/80 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">0x7a3f8B2d...6e8C2d</span>
              <button onClick={copyAddress} className="text-primary hover:text-primary/80">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <Button size="sm">
              <Send className="h-3.5 w-3.5 mr-2" />
              Envoyer
            </Button>
            <Button size="sm" variant="outline">
              <ArrowDownLeft className="h-3.5 w-3.5 mr-2" />
              Recevoir
            </Button>
            <Button size="sm" variant="outline">
              <QrCode className="h-3.5 w-3.5 mr-2" />
              QR Code
            </Button>
          </div>
        </div>
      </div>

      {/* Assets */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Vos Assets</h3>
        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.symbol} className="flex items-center justify-between bg-secondary/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{asset.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-bold text-foreground">
                  {showBalance ? asset.balance : "••••••"}
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs text-muted-foreground font-mono">{showBalance ? asset.usd : "••••"}</span>
                  <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/20 bg-green-500/5">
                    {asset.change}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Sécurité Wallet</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Multi-Signature", desc: "3/5 signatures requises", active: true },
            { label: "Cold Storage", desc: "Hardware keys connectées", active: true },
            { label: "Sauvegarde", desc: "Dernière: il y a 2h", active: true },
          ].map((sec) => (
            <div key={sec.label} className="bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs font-semibold text-foreground">{sec.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{sec.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}