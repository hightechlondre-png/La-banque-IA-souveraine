import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Play, Plus, Edit2, Trash2, CheckCircle, AlertTriangle, Code } from "lucide-react";

const CATEGORY_COLORS = {
  analysis: "text-primary",
  optimization: "text-accent",
  monitoring: "text-chart-2",
  execution: "text-orange-400",
  data: "text-chart-4",
};

export default function SkillManager() {
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "analysis",
    function_name: "",
    system_prompt: "",
  });

  const { data: skills = [] } = useQuery({
    queryKey: ["skills"],
    queryFn: () => base44.entities.Skill.list("-created_date", 100),
    refetchInterval: 5000,
  });

  const { data: executions = [] } = useQuery({
    queryKey: ["skill-executions"],
    queryFn: () => base44.entities.SkillExecution.list("-created_date", 200),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (selectedSkill) {
      setFormData({
        name: selectedSkill.name,
        description: selectedSkill.description || "",
        category: selectedSkill.category || "analysis",
        function_name: selectedSkill.function_name || "",
        system_prompt: selectedSkill.system_prompt || "",
      });
    }
  }, [selectedSkill]);

  const selectedSkillExecs = selectedSkill
    ? executions.filter((e) => e.skill_id === selectedSkill.id)
    : [];

  const successCount = selectedSkillExecs.filter(
    (e) => e.status === "success"
  ).length;
  const successRate =
    selectedSkillExecs.length > 0
      ? ((successCount / selectedSkillExecs.length) * 100).toFixed(1)
      : 0;
  const avgTime =
    selectedSkillExecs.filter((e) => e.execution_time_ms).length > 0
      ? (
          selectedSkillExecs.reduce((s, e) => s + (e.execution_time_ms || 0), 0) /
          selectedSkillExecs.filter((e) => e.execution_time_ms).length
        ).toFixed(0)
      : 0;

  const handleSaveSkill = async () => {
    if (!formData.name || !formData.function_name) return;

    try {
      if (selectedSkill) {
        await base44.entities.Skill.update(selectedSkill.id, formData);
        setSelectedSkill({ ...selectedSkill, ...formData });
      } else {
        const newSkill = await base44.entities.Skill.create(formData);
        setSelectedSkill(newSkill);
      }
      setIsEditing(false);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleTestSkill = async () => {
    if (!selectedSkill || !testInput.trim()) return;

    setTesting(true);
    setTestOutput("");

    try {
      const response = await base44.functions.invoke("testSkill", {
        skill_id: selectedSkill.id,
        skill_name: selectedSkill.name,
        test_input: testInput,
        system_prompt: formData.system_prompt,
      });

      setTestOutput(response.data.result || response.data.error || "No output");
    } catch (err) {
      setTestOutput(`Error: ${err.message}`);
    }

    setTesting(false);
  };

  const handleDeleteSkill = async () => {
    if (!selectedSkill) return;
    try {
      await base44.entities.Skill.delete(selectedSkill.id);
      setSelectedSkill(null);
      setIsEditing(false);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleNewSkill = () => {
    setSelectedSkill(null);
    setFormData({
      name: "",
      description: "",
      category: "analysis",
      function_name: "",
      system_prompt: "",
    });
    setIsEditing(true);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Gestionnaire de Skills
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Définissez des prompts, testez en bac à sable et analysez les performances
          </p>
        </div>
        <Button onClick={handleNewSkill} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau Skill
        </Button>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Skills list */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground mb-3">Skills ({skills.length})</h3>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {skills.map((skill) => {
              const isSelected = selectedSkill?.id === skill.id;
              const skillExecs = executions.filter((e) => e.skill_id === skill.id);
              const rate =
                skillExecs.length > 0
                  ? (
                      (skillExecs.filter((e) => e.status === "success").length /
                        skillExecs.length) *
                      100
                    ).toFixed(0)
                  : "—";

              return (
                <button
                  key={skill.id}
                  onClick={() => {
                    setSelectedSkill(skill);
                    setIsEditing(false);
                  }}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg border transition-all",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {skill.name}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[8px] mt-0.5",
                          CATEGORY_COLORS[skill.category]
                        )}
                      >
                        {skill.category}
                      </Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {rate}%
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {skillExecs.length}x
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedSkill && !isEditing && (
            <>
              {/* Skill details */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {selectedSkill.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedSkill.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteSkill}
                      className="text-red-400 border-red-500/30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Taux succès", value: `${successRate}%`, color: "text-green-400" },
                    { label: "Tests", value: selectedSkillExecs.length, color: "text-primary" },
                    { label: "Temps moyen", value: `${avgTime}ms`, color: "text-accent" },
                  ].map((k) => (
                    <div
                      key={k.label}
                      className="bg-secondary/50 rounded-lg p-2 text-center"
                    >
                      <p className="text-[10px] text-muted-foreground">{k.label}</p>
                      <p className={`text-sm font-bold font-mono ${k.color}`}>
                        {k.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* System prompt preview */}
                {selectedSkill.system_prompt && (
                  <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                    <p className="text-xs font-semibold text-foreground mb-1">
                      System Prompt
                    </p>
                    <p className="text-[10px] text-muted-foreground line-clamp-3">
                      {selectedSkill.system_prompt}
                    </p>
                  </div>
                )}

                <div className="h-px bg-border" />

                {/* Function info */}
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">
                    Fonction backend
                  </p>
                  <p className="text-xs font-mono text-foreground">
                    {selectedSkill.function_name}
                  </p>
                </div>
              </div>

              {/* Test sandbox */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Bac à Sable de Test
                  </h3>
                </div>

                <textarea
                  placeholder="Entrez votre test input..."
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  className="w-full h-20 p-3 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary text-sm"
                />

                <Button
                  onClick={handleTestSkill}
                  disabled={testing || !testInput.trim()}
                  className="w-full gap-2"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Test en cours...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Exécuter le test
                    </>
                  )}
                </Button>

                {testOutput && (
                  <div className="bg-secondary/40 rounded-lg p-3 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1">
                      Résultat
                    </p>
                    <p className="text-xs text-foreground line-clamp-5">
                      {testOutput}
                    </p>
                  </div>
                )}
              </div>

              {/* Test history */}
              {selectedSkillExecs.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3">
                    Historique des Tests
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedSkillExecs.slice(0, 10).map((exec, i) => (
                      <div
                        key={i}
                        className={cn(
                          "border rounded-lg p-2.5 text-xs",
                          exec.status === "success"
                            ? "border-green-500/20 bg-green-500/5"
                            : "border-red-500/20 bg-red-500/5"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {exec.status === "success" ? (
                            <CheckCircle className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-muted-foreground truncate">
                              {exec.test_input.substring(0, 50)}...
                            </p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              {exec.execution_time_ms}ms
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {isEditing && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground">
                {selectedSkill ? "Éditer le Skill" : "Créer un nouveau Skill"}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Nom du Skill
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full h-16 px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Catégorie
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary text-sm"
                  >
                    {[
                      "analysis",
                      "optimization",
                      "monitoring",
                      "execution",
                      "data",
                    ].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Fonction Backend
                  </label>
                  <input
                    type="text"
                    value={formData.function_name}
                    onChange={(e) =>
                      setFormData({ ...formData, function_name: e.target.value })
                    }
                    placeholder="ex: analyzeCode"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    System Prompt
                  </label>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        system_prompt: e.target.value,
                      })
                    }
                    placeholder="Définissez le comportement du skill..."
                    className="w-full h-24 px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveSkill} className="flex-1">
                  Sauvegarder
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {!selectedSkill && !isEditing && (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Code className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Sélectionnez un skill pour commencer
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}