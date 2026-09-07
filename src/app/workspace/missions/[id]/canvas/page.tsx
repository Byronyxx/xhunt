'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Save, Loader2, Play, Zap, BookOpen, Search,
  Send, Users, FlaskConical, Sparkles, Check, Trash2, LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { DbMission } from '@/lib/supabase/types';

// ── Step type config ────────────────────────────────────────────────────────────────

const STEP_TYPES = [
  { type: 'action',        label: 'Action',        icon: Zap,        color: '#FFB84D', desc: 'Do something' },
  { type: 'reflection',    label: 'Reflect',        icon: BookOpen,   color: '#6D5DFD', desc: 'Think & journal' },
  { type: 'discovery',     label: 'Discover',       icon: Search,     color: '#22FFAA', desc: 'Find or explore' },
  { type: 'research',      label: 'Research',       icon: FlaskConical,color: '#60A5FA', desc: 'Investigate' },
  { type: 'submission',    label: 'Submit',         icon: Send,       color: '#FF5C7A', desc: 'Deliver work' },
  { type: 'collaboration', label: 'Collaborate',    icon: Users,      color: '#A78BFA', desc: 'Work with others' },
] as const;

type StepType = typeof STEP_TYPES[number]['type'];

const TYPE_META: Record<StepType, typeof STEP_TYPES[number]> = Object.fromEntries(
  STEP_TYPES.map((s) => [s.type, s])
) as Record<StepType, typeof STEP_TYPES[number]>;

// ── Custom node: Start ────────────────────────────────────────────────────────────────────

function StartNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black"
        style={{ background: 'linear-gradient(135deg,#22FFAA,#6D5DFD)', color: '#050816' }}>
        🚀
      </div>
      <span className="text-[11px] font-bold text-[#22FFAA] uppercase tracking-wider">Start</span>
      <Handle type="source" position={Position.Bottom} style={{ background: '#22FFAA', border: 'none', width: 10, height: 10 }} />
      {(data.label as string | undefined) && (
        <span className="text-[10px] text-[#8B9CC0] max-w-[100px] text-center truncate">{data.label as string}</span>
      )}
    </div>
  );
}

// ── Custom node: Step ──────────────────────────────────────────────────────────────────────

function StepNode({ data, selected }: NodeProps) {
  const d = data as { stepType?: StepType; instruction?: string; stepIndex?: number; onEdit?: (d: Record<string, unknown>) => void };
  const { stepType = 'action', instruction = '', stepIndex = 0, onEdit } = d;
  const meta = TYPE_META[stepType as StepType] ?? TYPE_META.action;
  const Icon = meta.icon;

  return (
    <div
      className="rounded-2xl p-4 min-w-[200px] max-w-[240px] transition-all"
      style={{
        background: '#0A1226',
        border: `1.5px solid ${selected ? meta.color : 'rgba(255,255,255,0.1)'}`,
        boxShadow: selected ? `0 0 16px ${meta.color}30` : 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: meta.color, border: 'none', width: 10, height: 10 }} />

      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}>
          <Icon size={14} strokeWidth={2} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
              {meta.label} · Step {stepIndex + 1}
            </span>
          </div>
          <p className="text-[12px] leading-snug" style={{ color: '#F0F4FF' }}>
            {instruction || <span style={{ color: '#4A5578' }}>Click to add instruction…</span>}
          </p>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: meta.color, border: 'none', width: 10, height: 10 }} />
    </div>
  );
}

// ── Custom node: Reward ───────────────────────────────────────────────────────────────────

function RewardNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Top} style={{ background: '#FFB84D', border: 'none', width: 10, height: 10 }} />
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
        style={{ background: 'rgba(255,184,77,0.12)', border: '2px solid rgba(255,184,77,0.4)' }}>
        🏆
      </div>
      {/* @ts-expect-error — data fields are dynamic */}
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#FFB84D' }}>{data.reward || 'Reward'}</span>
    </div>
  );
}

const NODE_TYPES = { start: StartNode, step: StepNode, reward: RewardNode };

// ── Build graph from mission steps ─────────────────────────────────────────────────

function buildGraph(mission: DbMission): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: 'start',
    type: 'start',
    position: { x: 300, y: 40 },
    data: { label: mission.title },
  });

  const steps = (mission.steps ?? []) as { id: number; type: string; instruction: string; success_criteria: string }[];

  steps.forEach((step, i) => {
    const nodeId = `step-${step.id}`;
    nodes.push({
      id: nodeId,
      type: 'step',
      position: { x: 300, y: 160 + i * 140 },
      data: { stepType: step.type, instruction: step.instruction, stepIndex: i, stepId: step.id, successCriteria: step.success_criteria },
    });

    const prevId = i === 0 ? 'start' : `step-${steps[i - 1].id}`;
    edges.push({
      id: `e-${prevId}-${nodeId}`,
      source: prevId,
      target: nodeId,
      style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2 },
      animated: true,
    });
  });

  const rewardId = 'reward';
  nodes.push({
    id: rewardId,
    type: 'reward',
    position: { x: 300, y: 160 + steps.length * 140 },
    data: { reward: mission.reward },
  });

  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    edges.push({
      id: `e-step-${lastStep.id}-reward`,
      source: `step-${lastStep.id}`,
      target: rewardId,
      style: { stroke: 'rgba(255,184,77,0.4)', strokeWidth: 2 },
      animated: true,
    });
  } else {
    edges.push({ id: 'e-start-reward', source: 'start', target: rewardId, style: { stroke: 'rgba(255,184,77,0.3)', strokeWidth: 2 }, animated: true });
  }

  return { nodes, edges };
}

// ── Panel: Edit selected step ──────────────────────────────────────────────────────────────────────

function EditPanel({ node, onUpdate, onDelete }: {
  node: Node | null;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [instruction, setInstruction] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [stepType, setStepType] = useState<StepType>('action');

  useEffect(() => {
    if (node?.type === 'step') {
      setInstruction((node.data as Record<string, string>).instruction ?? '');
      setSuccessCriteria((node.data as Record<string, string>).successCriteria ?? '');
      setStepType(((node.data as Record<string, string>).stepType ?? 'action') as StepType);
    }
  }, [node?.id]);

  if (!node || node.type !== 'step') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
        <LayoutGrid size={28} strokeWidth={1.5} style={{ color: '#4A5578' }} />
        <p className="text-[13px] text-[#4A5578] text-center">Select a step node to edit its content and type.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <p className="text-[13px] font-bold text-[#F0F4FF]">Edit Step</p>

      {/* Type picker */}
      <div>
        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Step Type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {STEP_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.type} onClick={() => setStepType(t.type as StepType)}
                className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all',
                  stepType === t.type
                    ? 'border-current'
                    : 'border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]')}
                style={{ color: stepType === t.type ? t.color : '#8B9CC0', background: stepType === t.type ? `${t.color}10` : '#07101F' }}>
                <Icon size={11} strokeWidth={2} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instruction */}
      <div>
        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Instruction</label>
        <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3}
          placeholder="What should the participant do?"
          className="w-full px-3 py-2 rounded-xl text-[13px] resize-none focus:outline-none"
          style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
      </div>

      {/* Success criteria */}
      <div>
        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Success Criteria</label>
        <textarea value={successCriteria} onChange={(e) => setSuccessCriteria(e.target.value)} rows={2}
          placeholder="You're done when…"
          className="w-full px-3 py-2 rounded-xl text-[13px] resize-none focus:outline-none"
          style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={() => onUpdate(node.id, { instruction, successCriteria, stepType })}
          className="flex-1 h-9 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2"
          style={{ background: 'rgba(34,255,170,0.1)', color: '#22FFAA', border: '1px solid rgba(34,255,170,0.2)' }}>
          <Check size={14} strokeWidth={2.5} />Update
        </button>
        <button onClick={() => onDelete(node.id)}
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,92,122,0.08)', color: '#FF5C7A', border: '1px solid rgba(255,92,122,0.2)' }}>
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ── Main canvas page ───────────────────────────────────────────────────────────────────────────

export default function MissionCanvasPage() {
  const params    = useParams();
  const router    = useRouter();
  const missionId = params?.id as string;

  const [mission,  setMission]  = useState<DbMission | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [selected, setSelected] = useState<Node | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/missions/${missionId}`);
      if (res.ok) {
        const { mission: data } = await res.json();
        setMission(data as DbMission);
        const { nodes: n, edges: e } = buildGraph(data as DbMission);
        setNodes(n);
        setEdges(e);
      }
      setLoading(false);
    }
    void load();
  }, [missionId]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 } }, eds)),
    [setEdges],
  );

  function addStep() {
    const stepIndex = nodes.filter((n) => n.type === 'step').length;
    const newId     = `step-new-${Date.now()}`;
    const lastStep  = nodes.filter((n) => n.type === 'step').pop();
    const rewardNode = nodes.find((n) => n.type === 'reward');

    const newNode: Node = {
      id:       newId,
      type:     'step',
      position: lastStep
        ? { x: lastStep.position.x, y: lastStep.position.y + 140 }
        : { x: 300, y: 160 },
      data: { stepType: 'action', instruction: '', successCriteria: '', stepIndex, stepId: Date.now() },
    };

    setNodes((nds) => {
      // Push reward node down
      return nds.map((n) => n.id === 'reward' ? { ...n, position: { ...n.position, y: n.position.y + 140 } } : n).concat(newNode);
    });

    // Connect last step → new step, new step → reward
    if (lastStep) {
      setEdges((eds) => addEdge({ id: `e-${lastStep.id}-${newId}`, source: lastStep.id, target: newId, animated: true, style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2 } }, eds));
    }
    if (rewardNode) {
      setEdges((eds) => addEdge({ id: `e-${newId}-reward`, source: newId, target: 'reward', animated: true, style: { stroke: 'rgba(255,184,77,0.3)', strokeWidth: 2 } }, eds));
      // Remove old last→reward edge
      if (lastStep) setEdges((eds) => eds.filter((e) => !(e.source === lastStep.id && e.target === 'reward')));
    }
  }

  function updateNode(id: string, data: Record<string, unknown>) {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
    setSelected((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev);
  }

  function deleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelected(null);
  }

  async function saveCanvas() {
    if (!mission) return;
    setSaving(true);

    const stepNodes = nodes
      .filter((n) => n.type === 'step')
      .sort((a, b) => a.position.y - b.position.y);

    const steps = stepNodes.map((n, i) => ({
      id: (n.data as Record<string, unknown>).stepId ?? Date.now() + i,
      type: (n.data as Record<string, unknown>).stepType ?? 'action',
      instruction: (n.data as Record<string, unknown>).instruction ?? '',
      success_criteria: (n.data as Record<string, unknown>).successCriteria ?? '',
    }));

    await fetch(`/api/missions/${missionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps }),
    });
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#050816' }}>
        <Loader2 size={28} className="animate-spin text-[#22FFAA]" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#050816' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b"
        style={{ background: '#07101F', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/workspace/missions/${missionId}`)}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: '#0A1226', border: '1px solid rgba(255,255,255,0.07)' }}>
            <ArrowLeft size={15} strokeWidth={2} style={{ color: '#8B9CC0' }} />
          </button>
          <div>
            <p className="text-[14px] font-bold text-[#F0F4FF]">{mission?.title}</p>
            <p className="text-[11px] text-[#4A5578]">Visual Canvas · {nodes.filter((n) => n.type === 'step').length} steps</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addStep}
            className="flex items-center gap-2 h-8 px-3 rounded-xl text-[12px] font-semibold"
            style={{ background: 'rgba(34,255,170,0.08)', border: '1px solid rgba(34,255,170,0.2)', color: '#22FFAA' }}>
            <Plus size={13} strokeWidth={2.5} />Add Step
          </button>
          <button onClick={saveCanvas} disabled={saving}
            className="flex items-center gap-2 h-8 px-4 rounded-xl text-[13px] font-bold disabled:opacity-50"
            style={{ background: '#22FFAA', color: '#050816' }}>
            {saving    ? <Loader2 size={13} className="animate-spin" /> :
             saved     ? <Check size={13} strokeWidth={2.5} /> :
                         <Save size={13} strokeWidth={2} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Canvas + Panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelected(node)}
            onPaneClick={() => setSelected(null)}
            nodeTypes={NODE_TYPES}
            fitView
            style={{ background: '#050816' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(255,255,255,0.04)" gap={20} />
            <Controls style={{ background: '#0A1226', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
            <MiniMap
              style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}
              nodeColor={(n) => {
                if (n.type === 'start') return '#22FFAA';
                if (n.type === 'reward') return '#FFB84D';
                const meta = TYPE_META[((n.data as Record<string, string>).stepType ?? 'action') as StepType];
                return meta?.color ?? '#6D5DFD';
              }}
            />
          </ReactFlow>
        </div>

        {/* Right panel */}
        <div className="w-[280px] border-l flex flex-col"
          style={{ background: '#07101F', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#6D5DFD]" strokeWidth={2} />
              <p className="text-[13px] font-bold text-[#F0F4FF]">
                {selected?.type === 'step' ? 'Edit Step' : 'Canvas'}
              </p>
            </div>
          </div>
          <EditPanel node={selected} onUpdate={updateNode} onDelete={deleteNode} />
          <div className="px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div><p className="font-bold text-[#F0F4FF]">{nodes.filter((n) => n.type === 'step').length}</p><p className="text-[#4A5578]">Steps</p></div>
              <div><p className="font-bold text-[#F0F4FF]">{edges.length}</p><p className="text-[#4A5578]">Connections</p></div>
              <div><p className="font-bold text-[#F0F4FF]">{new Set(nodes.filter((n) => n.type === 'step').map((n) => (n.data as Record<string, string>).stepType)).size}</p><p className="text-[#4A5578]">Types</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
