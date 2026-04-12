import { SlidersHorizontal } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RulesSettings() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-4">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-purple-400" />
            Rules & Parameters
          </CardTitle>
          <CardDescription>
            The canonical system rules now live in the Admin Panel ruleset editor so the frontend and orchestrator stay aligned.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use the Admin Panel to edit the hub YAML files that power ManagerAgent routing, security, and behavior. This keeps
            rules in one source of truth instead of splitting them across local browser state.
          </p>

          <Button
            onClick={() => navigate("/admin")}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            Open Admin Ruleset
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
