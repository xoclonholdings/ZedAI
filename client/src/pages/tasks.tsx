import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, CheckSquare, Plus, User, X, Zap } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";

type Assignee = "user" | "zar" | "both";

interface TaskRecord {
  id: string;
  status: "pending" | "approved" | "in_progress" | "blocked" | "complete";
  plan: { summary: string };
  approval_status?: "not_required" | "user_required" | "admin_required" | "approved" | "rejected" | "manual_handling_required";
  acceptance_status?: "proposed" | "accepted" | "denied";
  origin?: "user" | "zar";
  assignee?: Assignee;
  scheduled_for?: string | null;
}

interface TasksResponse {
  tasks: TaskRecord[];
}

const QUERY_KEY = ["/api/execution/tasks"];

export default function TasksPage() {
  const [draft, setDraft] = useState("");
  const [assignee, setAssignee] = useState<Assignee>("user");
  const [scheduledFor, setScheduledFor] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<TasksResponse>({ queryKey: QUERY_KEY, refetchInterval: 15_000 });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["/api/approval/notifications?unread=true"] }),
    ]);
  };

  const createTask = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/execution/tasks", {
        text: draft.trim(),
        assignee,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
      });
      return response.json();
    },
    onSuccess: async () => {
      setDraft("");
      setScheduledFor("");
      setShowComposer(false);
      await refresh();
    },
  });

  const decideSuggestion = useMutation({
    mutationFn: async ({ id, accepted }: { id: string; accepted: boolean }) => {
      const response = await apiRequest("POST", `/api/execution/tasks/${id}/acceptance`, { accepted });
      return response.json();
    },
    onSuccess: refresh,
  });

  const decideAction = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const response = await apiRequest("POST", "/api/approval/decide", {
        task_id: id,
        action: approved ? "approve" : "reject",
      });
      return response.json();
    },
    onSuccess: refresh,
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/execution/tasks/${id}/complete`),
    onSuccess: refresh,
  });

  const tasks = data?.tasks ?? [];
  const mutationError = createTask.error || decideSuggestion.error || decideAction.error || completeTask.error;
  const suggestions = useMemo(() => tasks.filter((task) => task.acceptance_status === "proposed"), [tasks]);
  const activeTasks = useMemo(() => tasks.filter((task) => (
    task.acceptance_status !== "proposed" &&
    task.acceptance_status !== "denied" &&
    task.status !== "complete" &&
    task.approval_status !== "rejected"
  )), [tasks]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Task</h1>
          <p className="text-[12px] text-white/45">A shared list for you and ZAR.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowComposer((value) => !value)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-300 text-black hover:bg-cyan-200"
          aria-label="Add task"
        >
          {showComposer ? <X size={16} /> : <Plus size={17} />}
        </button>
      </div>

      {showComposer ? (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-3">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What needs to be done?"
            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-200/40"
          />
          <div className="grid grid-cols-3 gap-2">
            {(["user", "zar", "both"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAssignee(value)}
                className={`rounded-xl border px-2 py-2 text-[11px] capitalize transition ${
                  assignee === value
                    ? "border-cyan-200/40 bg-cyan-200/10 text-cyan-100"
                    : "border-white/10 bg-black/30 text-white/55"
                }`}
              >
                {value === "user" ? "You" : value === "zar" ? "ZAR" : "Both"}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-[10.5px] uppercase tracking-[0.12em] text-white/40">When - optional</span>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-200/40"
            />
          </label>
          <button
            type="button"
            onClick={() => createTask.mutate()}
            disabled={!draft.trim() || createTask.isPending}
            className="w-full rounded-xl bg-cyan-300 px-3 py-2 text-sm font-medium text-black hover:bg-cyan-200 disabled:opacity-35"
          >
            Add task
          </button>
        </section>
      ) : null}

      {mutationError ? (
        <div className="rounded-xl border border-red-300/25 bg-red-300/[0.06] px-3 py-2 text-[12px] text-red-100">
          {mutationError instanceof Error ? mutationError.message : "Task update failed. Try again."}
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-violet-200/70">
            <Zap size={13} /> ZAR suggestions
          </div>
          {suggestions.map((task) => (
            <article key={task.id} className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.05] p-3">
              <p className="text-[13.5px] leading-5 text-white/85">{task.plan.summary}</p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => decideSuggestion.mutate({ id: task.id, accepted: false })}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-red-300/25 text-red-200 hover:bg-red-300/10"
                  aria-label="Deny suggestion"
                >
                  <X size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => decideSuggestion.mutate({ id: task.id, accepted: true })}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15"
                  aria-label="Approve suggestion"
                >
                  <Check size={15} />
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-white/40">Loading tasks...</p>
        ) : activeTasks.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
            <CheckSquare size={20} className="mb-2 text-white/30" />
            <p className="text-sm text-white/45">Nothing on the list yet.</p>
          </div>
        ) : activeTasks.map((task) => {
          const actionApprovalNeeded = task.acceptance_status === "accepted" && (
            task.approval_status === "user_required" || task.approval_status === "admin_required"
          );
          return (
            <article key={task.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => completeTask.mutate(task.id)}
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/30 hover:border-emerald-200/40 hover:text-emerald-100"
                  aria-label="Complete task"
                >
                  <Check size={13} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] leading-5 text-white/85">{task.plan.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10.5px] text-white/40">
                    <span className="inline-flex items-center gap-1"><User size={11} /> {assigneeLabel(task.assignee)}</span>
                    {task.scheduled_for ? (
                      <span className="inline-flex items-center gap-1"><CalendarClock size={11} /> {new Date(task.scheduled_for).toLocaleString()}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              {actionApprovalNeeded ? (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2">
                  <span className="text-[11.5px] text-amber-100/75">Action approval needed</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => decideAction.mutate({ id: task.id, approved: false })} className="rounded-full p-1.5 text-red-200 hover:bg-red-300/10" aria-label="Deny action"><X size={14} /></button>
                    <button type="button" onClick={() => decideAction.mutate({ id: task.id, approved: true })} className="rounded-full p-1.5 text-emerald-100 hover:bg-emerald-300/10" aria-label="Approve action"><Check size={14} /></button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}

function assigneeLabel(assignee?: Assignee): string {
  if (assignee === "zar") return "ZAR";
  if (assignee === "both") return "You + ZAR";
  return "You";
}
