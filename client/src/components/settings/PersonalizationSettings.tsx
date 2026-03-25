import { User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PersonalizationSettings() {
  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Personalization
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-muted-foreground">
          Customize your ZED experience with personalized settings and
          preferences.
        </p>
      </CardContent>
    </Card>
  );
}