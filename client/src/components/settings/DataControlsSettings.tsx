import { useState } from "react";
import { Database, Trash2, AlertTriangle, CheckCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clearAppSettings } from "@/hooks/useAppSettings";

type State = "idle" | "confirming" | "clearing" | "done" | "error";

export default function DataControlsSettings() {
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<string>("");

  async function handleClearData() {
    if (state === "idle") {
      setState("confirming");
      return;
    }
    if (state === "confirming") {
      setState("clearing");
      try {
        // 1. Delete all conversations from server
        const res = await fetch("/api/conversations", {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json();

        // 2. Clear stored settings from localStorage
        clearAppSettings();
        localStorage.removeItem("zed_sidebar_state");

        setResult(`Cleared ${data.deleted ?? 0} conversation(s) and local preferences.`);
        setState("done");
      } catch (err: any) {
        setResult(`Error: ${err.message}`);
        setState("error");
      }
    }
  }

  function reset() {
    setState("idle");
    setResult("");
  }

  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-cyan-400" />
          Data Controls
        </CardTitle>
        <CardDescription>
          Manage your stored data, cache, and memory usage within ZED.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {state === "done" && (
          <div className="flex items-start gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-xs text-green-300">
            <CheckCircle size={14} className="mt-0.5 shrink-0" />
            {result}
          </div>
        )}

        {state === "error" && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {result}
          </div>
        )}

        {state === "confirming" && (
          <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            This will permanently delete all conversations and reset your local settings. This cannot be undone.
          </div>
        )}

        <p className="text-muted-foreground text-sm">
          Deletes your conversation history from the server and resets local preferences to defaults.
        </p>

        <div className="flex gap-2">
          {state === "done" || state === "error" ? (
            <Button variant="outline" size="sm" onClick={reset} className="border-white/10">
              Dismiss
            </Button>
          ) : (
            <>
              <Button
                variant="destructive"
                onClick={handleClearData}
                disabled={state === "clearing"}
                className="flex-1 gap-2"
              >
                <Trash2 size={14} />
                {state === "idle" && "Delete My Conversations"}
                {state === "confirming" && "Confirm — Delete Everything"}
                {state === "clearing" && "Clearing…"}
              </Button>
              {state === "confirming" && (
                <Button variant="outline" size="sm" onClick={reset} className="border-white/10">
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
