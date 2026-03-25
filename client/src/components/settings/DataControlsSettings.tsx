import { Database } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DataControlsSettings() {
  const handleClearData = () => {
    // ⚠️ Replace with real logic later (API call, local storage clear, etc.)
    console.log("Clearing user data...");
  };

  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Controls
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Manage your stored data, cache, and memory usage within ZED.
        </p>

        <Button
          variant="destructive"
          onClick={handleClearData}
          className="w-full"
        >
          Clear Local Data
        </Button>
      </CardContent>
    </Card>
  );
}