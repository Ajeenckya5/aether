"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sportLabel } from "@/lib/sports";
import {
  BLOCK_PRESETS,
  BUILDER_SPORTS,
  asCoachSession,
  emptyBlock,
  getCustomWorkout,
  uid,
  upsertCustomWorkout,
  workoutDurationSec,
  type CustomWorkout,
  type TrainingLevel,
  type WorkoutBlock,
} from "@/lib/sessions";

const LEVELS: TrainingLevel[] = ["Recover", "Build", "Push"];

export function WorkoutBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const [title, setTitle] = useState("My session");
  const [sport, setSport] = useState("running");
  const [level, setLevel] = useState<TrainingLevel>("Build");
  const [summary, setSummary] = useState("");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([emptyBlock()]);
  const [id, setId] = useState(() => uid("cw"));

  useEffect(() => {
    if (!editId) return;
    const existing = getCustomWorkout(editId);
    if (!existing) return;
    setId(existing.id);
    setTitle(existing.title);
    setSport(existing.sport);
    setLevel(existing.level);
    setSummary(existing.summary);
    setBlocks(existing.blocks.length ? existing.blocks : [emptyBlock()]);
  }, [editId]);

  const durationMin = useMemo(
    () => Math.max(1, Math.round(workoutDurationSec({ blocks } as CustomWorkout) / 60)),
    [blocks],
  );

  function patchBlock(blockId: string, patch: Partial<WorkoutBlock>) {
    setBlocks((rows) => rows.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
  }

  function addPreset(label: string) {
    const preset = BLOCK_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setBlocks((rows) => [
      ...rows.filter((b) => !(rows.length === 1 && b.title === "Block" && b.seconds === 60)),
      ...preset.blocks.map((b) => ({ ...b, id: uid("bk") })),
    ]);
  }

  function save(): CustomWorkout {
    const workout: CustomWorkout = {
      id,
      title: title.trim() || "Untitled",
      sport,
      level,
      summary: summary.trim(),
      blocks: blocks.filter((b) => b.seconds > 0),
      createdAt: getCustomWorkout(id)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!workout.blocks.length) workout.blocks = [emptyBlock()];
    upsertCustomWorkout(workout);
    return workout;
  }

  return (
    <div className="px-5 pt-14 pb-10">
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime">Builder</p>
      <h1 className="font-display mt-2 text-4xl">Build a workout</h1>
      <p className="mt-2 text-sm text-muted">
        Blocks, target zones, then play it guided or track it live with a strap.
      </p>

      <label className="mt-6 block text-xs text-muted">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-white/10 bg-white/4 px-3 py-2 text-sm text-paper outline-none"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Sport
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            {BUILDER_SPORTS.map((s) => (
              <option key={s} value={s}>
                {sportLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Level
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as TrainingLevel)}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-xs text-muted">
        Notes
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-2xl border border-white/10 bg-white/4 px-3 py-2 text-sm text-paper outline-none"
        />
      </label>

      <p className="mt-5 text-[11px] uppercase tracking-widest text-muted">
        Presets · {durationMin} min
      </p>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {BLOCK_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => addPreset(p.label)}
            className="shrink-0 rounded-full bg-white/8 px-3 py-1.5 text-xs"
          >
            + {p.label}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {blocks.map((block, i) => (
          <li key={block.id} className="rounded-3xl border border-white/8 bg-panel p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted">
              Block {i + 1}
              <button
                type="button"
                onClick={() =>
                  setBlocks((rows) => (rows.length <= 1 ? rows : rows.filter((b) => b.id !== block.id)))
                }
                className="text-ember disabled:opacity-30"
                disabled={blocks.length <= 1}
              >
                Remove
              </button>
            </div>
            <input
              value={block.title}
              aria-label={`Block ${i + 1} name`}
              onChange={(e) => patchBlock(block.id, { title: e.target.value })}
              className="mt-2 w-full rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm outline-none"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                Seconds
                <input
                  type="number"
                  min={10}
                  max={7200}
                  value={block.seconds}
                  onChange={(e) =>
                    patchBlock(block.id, { seconds: Math.max(10, Number(e.target.value) || 60) })
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="text-xs text-muted">
                Target zone
                <select
                  value={block.targetZone ?? ""}
                  onChange={(e) =>
                    patchBlock(block.id, {
                      targetZone: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {[0, 1, 2, 3, 4, 5].map((z) => (
                    <option key={z} value={z}>
                      Z{z}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <input
              value={block.cue}
              onChange={(e) => patchBlock(block.id, { cue: e.target.value })}
              placeholder="Cue"
              aria-label={`Block ${i + 1} cue`}
              className="mt-2 w-full rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm outline-none placeholder:text-muted"
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setBlocks((rows) => [...rows, emptyBlock()])}
        className="mt-3 w-full rounded-full border border-white/15 py-3 text-sm"
      >
        Add block
      </button>

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          onClick={() => {
            const workout = save();
            router.push(`/coach/custom?id=${encodeURIComponent(workout.id)}`);
          }}
          className="rounded-full bg-lime py-3 text-sm font-medium text-ink"
        >
          Save and play guided
        </button>
        <button
          type="button"
          onClick={() => {
            const workout = save();
            router.push(`/coach/live?kind=custom&id=${workout.id}`);
          }}
          className="rounded-full bg-ember py-3 text-sm font-medium text-ink"
        >
          Save and track live
        </button>
        <button
          type="button"
          onClick={() => {
            save();
            router.push("/coach");
          }}
          className="rounded-full border border-white/15 py-3 text-sm"
        >
          Save only
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">
        Preview as {asCoachSession({
          id,
          title,
          sport,
          level,
          summary,
          blocks,
          createdAt: "",
          updatedAt: "",
        }).durationMin}{" "}
        min · {blocks.length} blocks
      </p>
    </div>
  );
}
