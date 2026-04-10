import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function UserManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="h-6 w-6 text-purple-400" />
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          User Management
        </h2>
      </div>

      <Card className="bg-black/60 border-purple-500/20">
        <CardContent className="p-8 text-center space-y-3">
          <Shield className="h-12 w-12 text-purple-500/50 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-300">Single-User Mode</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            ZED is currently running in single-admin mode. Multi-user access will be enabled
            when the system is ready for Trust and family access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
