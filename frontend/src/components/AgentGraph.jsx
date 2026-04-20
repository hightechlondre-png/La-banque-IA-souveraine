import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ROLE_COLORS = {
  analyst: "#3b82f6",
  optimizer: "#f59e0b",
  monitor: "#10b981",
  executor: "#ef4444",
  coordinator: "#8b5cf6",
};

const STATUS_COLORS = {
  success: "#22c55e",
  failed: "#ef4444",
  running: "#f59e0b",
  pending: "#64748b",
};

export default function AgentGraph({ agents = [], executions = [] }) {
  const svgRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!svgRef.current || agents.length === 0) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const width = rect.width || 900;
    const height = rect.height || 600;

    // Clear previous
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Build node positions using simple hierarchy layout
    const nodeMap = new Map();
    const positions = {};
    let y = 50;
    const depth = {};

    // Calculate depths
    executions.forEach((exec) => {
      const d = depth[exec.agent_id] || 0;
      depth[exec.agent_id] = Math.max(d, exec.depth || 1);
    });

    // Position nodes hierarchically
    agents.forEach((agent, i) => {
      const d = depth[agent.id] || 1;
      positions[agent.id] = {
        x: 100 + (d - 1) * 250,
        y: 80 + i * 100,
        depth: d,
      };
      nodeMap.set(agent.id, agent);
    });

    // Create SVG group for pan/zoom
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${pan.x}, ${pan.y}) scale(${zoom})`);

    // Draw connections (agent → execution relationships)
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const arrowMarker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    arrowMarker.setAttribute("id", "arrowhead");
    arrowMarker.setAttribute("markerWidth", "10");
    arrowMarker.setAttribute("markerHeight", "10");
    arrowMarker.setAttribute("refX", "9");
    arrowMarker.setAttribute("refY", "3");
    arrowMarker.setAttribute("orient", "auto");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", "0 0, 10 3, 0 6");
    poly.setAttribute("fill", "#64748b");
    arrowMarker.appendChild(poly);
    defs.appendChild(arrowMarker);
    g.appendChild(defs);

    // Draw execution flows
    executions.forEach((exec) => {
      if (!positions[exec.agent_id]) return;

      const start = positions[exec.agent_id];
      const color = STATUS_COLORS[exec.status] || "#64748b";

      // Draw spawned agent connections
      (exec.spawned_agents || []).forEach((spawnedId) => {
        if (!positions[spawnedId]) return;
        const end = positions[spawnedId];

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", start.x + 80);
        line.setAttribute("y1", start.y + 40);
        line.setAttribute("x2", end.x);
        line.setAttribute("y2", end.y);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "2");
        line.setAttribute("opacity", "0.6");
        line.setAttribute("marker-end", "url(#arrowhead)");
        g.appendChild(line);
      });
    });

    // Draw agent nodes
    agents.forEach((agent) => {
      const pos = positions[agent.id];
      const isSelected = selectedNode?.id === agent.id;
      const color = ROLE_COLORS[agent.role];
      const recentExec = executions.filter((e) => e.agent_id === agent.id)[0];

      // Circle node
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", pos.x + 80);
      circle.setAttribute("cy", pos.y + 40);
      circle.setAttribute("r", isSelected ? 45 : 35);
      circle.setAttribute("fill", color);
      circle.setAttribute("opacity", "0.8");
      circle.setAttribute("stroke", isSelected ? "#fff" : color);
      circle.setAttribute("stroke-width", isSelected ? "3" : "1");
      circle.setAttribute("class", "cursor-pointer hover:opacity-100 transition-all");
      circle.addEventListener("click", () => setSelectedNode(agent));
      g.appendChild(circle);

      // Status indicator (small circle)
      if (recentExec) {
        const statusCircle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        statusCircle.setAttribute("cx", pos.x + 110);
        statusCircle.setAttribute("cy", pos.y + 10);
        statusCircle.setAttribute("r", "6");
        statusCircle.setAttribute("fill", STATUS_COLORS[recentExec.status]);
        g.appendChild(statusCircle);
      }

      // Label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", pos.x + 80);
      text.setAttribute("y", pos.y + 45);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dy", "0.3em");
      text.setAttribute("font-size", "11");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("fill", "#fff");
      text.setAttribute("pointer-events", "none");
      text.textContent = agent.name.substring(0, 8);
      g.appendChild(text);

      // Depth label
      const depthText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      depthText.setAttribute("x", pos.x + 80);
      depthText.setAttribute("y", pos.y + 60);
      depthText.setAttribute("text-anchor", "middle");
      depthText.setAttribute("font-size", "9");
      depthText.setAttribute("fill", "#94a3b8");
      depthText.setAttribute("pointer-events", "none");
      depthText.textContent = `L${pos.depth}`;
      g.appendChild(depthText);
    });

    svg.appendChild(g);
  }, [agents, executions, selectedNode, pan, zoom]);

  const handleWheel = (e) => {
    e.preventDefault();
    const newZoom = Math.max(0.5, Math.min(3, zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
    setZoom(newZoom);
  };

  const handleMouseDown = (e) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = { ...pan };

    const handleMouseMove = (moveEvent) => {
      setPan({
        x: startPan.x + (moveEvent.clientX - startX),
        y: startPan.y + (moveEvent.clientY - startY),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const selectedAgentData = selectedNode
    ? agents.find((a) => a.id === selectedNode.id)
    : null;
  const selectedExecData = selectedNode
    ? executions.filter((e) => e.agent_id === selectedNode.id)
    : [];

  return (
    <div className="space-y-4">
      <svg
        ref={svgRef}
        className="w-full border border-border rounded-lg bg-secondary/20 cursor-grab active:cursor-grabbing"
        style={{ height: "500px" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      />

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ background: ROLE_COLORS.analyst }} />
          <span className="text-muted-foreground">Analyst</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ background: ROLE_COLORS.optimizer }} />
          <span className="text-muted-foreground">Optimizer</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ background: ROLE_COLORS.monitor }} />
          <span className="text-muted-foreground">Monitor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ background: STATUS_COLORS.success }} />
          <span className="text-muted-foreground">Success</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ background: STATUS_COLORS.running }} />
          <span className="text-muted-foreground">Running</span>
        </div>
      </div>

      {/* Selection details */}
      {selectedAgentData && (
        <div className="bg-card border border-primary/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground">{selectedAgentData.name}</h4>
              <p className="text-xs text-muted-foreground">{selectedAgentData.role}</p>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-muted-foreground">{selectedAgentData.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded p-2">
              <p className="text-[10px] text-muted-foreground">Exécutions</p>
              <p className="font-mono font-bold text-foreground">
                {selectedAgentData.total_executions || 0}
              </p>
            </div>
            <div className="bg-secondary/50 rounded p-2">
              <p className="text-[10px] text-muted-foreground">Skills</p>
              <p className="font-mono font-bold text-foreground">
                {(selectedAgentData.skills || []).length}
              </p>
            </div>
          </div>

          {selectedExecData.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Exécutions récentes</p>
              <div className="space-y-1">
                {selectedExecData.slice(0, 3).map((exec, i) => (
                  <div key={i} className="text-[10px] bg-secondary/40 rounded px-2 py-1">
                    <span className="text-muted-foreground">
                      {exec.prompt.substring(0, 40)}...
                    </span>
                    <span className="ml-1 text-green-400">
                      {exec.status === "success" ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}