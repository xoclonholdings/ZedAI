import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckSquare, User, Zap } from "lucide-react";

export type Assignee = "user" | "zar" | "both";

export interface TaskRecord {
  id: string;
  status: "pending" | "approved" | "in_progress" | "blocked" | "complete";
  plan: { summary: string };
  approval_status?: "not_required" | "user_required" | "admin_required" | "approved" | "rejected" | "manual_handling_required";
  acceptance_status?: "proposed" | "accepted" | "denied";
  origin?: "user" | "zar";
  assignee?: Assignee;
  scheduled_for?: string | null;
}

export interface TasksResponse {
  tasks: TaskRecord[];
}

export const TASKS_QUERY_KEY = ["/api/execution/tasks"];

/** Display-only console surface for Tasks managed through the persistent dock. */
export default function TasksPage() {
  const { data, isLoading } = useQuery<TasksResponse>({ queryKey: TASKS_QUERY_KEY, refetchInterval: 15_000 });

  const tasks = data?.tasks ?? [];
  const suggestions = useMemo(() => tasks.filter((task) => task.acceptance_status === "proposed"), [tasks]);
  const activeTasks = useMemo(() => tasks.filter((task) => (
    task.acceptance_status !== "proposed" &&
    task.acceptance_status !== "denied" &&
    task.status !== "complete" &&
    task.approval_status !== "rejected"
  )), [tasks]);

  return (
    <main className="mx-auto flex h-full max-w-2xl flex-col p-4" data-task-screen="output-only">
      <div className="pb-3">
        <h1 className="text-lg font-semibold text-white">Task</h1>
        <p className="text-[12px] text-white/45">A shared list for you and ZAR.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {suggestions.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-violet-200/70">
              <Zap size={13} /> ZAR suggestions
            </div>
            <div
              className="mt-2 divide-y divide-white/[0.08] border-y border-white/[0.08]"
              data-list-presentation="rows"
            >
              {suggestions.map((task) => (
                <article key={task.id} className="py-3">
                  <p className="text-[13.5px] leading-5 text-white/85">{task.plan.summary}</p>
                  <span className="mt-1 block text-[10.5px] text-violet-200/55">Awaiting your review</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className={suggestions.length > 0 ? "mt-5" : undefined}>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-white/40">Loading tasks...</p>
          ) : activeTasks.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center text-center">
              <CheckSquare size={20} className="mb-2 text-white/30" />
              <p className="text-sm text-white/45">Nothing on the list yet.</p>
            </div>
          ) : (
            <div
              className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
              data-list-presentation="rows"
            >
              {activeTasks.map((task) => {
                const actionApprovalNeeded = task.acceptance_status === "accepted" && (
                  task.approval_status === "user_required" || task.approval_status === "admin_required"
                );
                return (
                  <article key={task.id} className="py-3">
                    <div className="flex items-start gap-3">
                      <CheckSquare size={15} className="mt-0.5 shrink-0 text-white/30" />
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
                      <span className="mt-2 block text-[11.5px] text-amber-100/75">Action approval needed</span>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function assigneeLabel(assignee?: Assignee): string {
  if (assignee === "zar") return "ZAR";
  if (assignee === "both") return "You + ZAR";
  return "You";
}
