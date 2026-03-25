import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  Menu,
  X
} from "lucide-react";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";
import { Link, useLocation } from "wouter";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Chat", icon: MessageSquare },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 p-0 zed-button rounded-xl"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Navigation Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full w-64 zed-sidebar z-50 transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:block
      `}>
        <div className="p-6">
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-8">
            <div>
              <h2 className="text-xl font-bold flex items-center space-x-2">
                <img src={zLogoPath} alt="Z" className="w-5 h-5" />
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
              </h2>
              <p className="text-xs text-muted-foreground">AI Assistant</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = location === item.path || 
                (item.path === "/" && location.startsWith("/chat"));
              const Icon = item.icon;

              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`
                      w-full justify-start space-x-3 h-12 text-left zed-button
                      ${isActive 
                        ? 'zed-glass border-purple-500/50 shadow-lg shadow-purple-500/20 text-purple-400' 
                        : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}