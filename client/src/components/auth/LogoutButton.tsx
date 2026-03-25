import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { logoutRequest } from "./AuthApi";

export default function LogoutButton() {
  async function handleLogout() {
    await logoutRequest();
    window.location.href = "/";
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="zed-button rounded-xl text-muted-foreground hover:text-foreground"
    >
      <LogOut size={16} />
    </Button>
  );
}