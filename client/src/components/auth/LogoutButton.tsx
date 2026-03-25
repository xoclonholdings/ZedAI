import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

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