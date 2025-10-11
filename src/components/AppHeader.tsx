import { UserMenu } from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Target } from "lucide-react";
import { useState } from "react";
import { useActiveMatch } from "@/hooks/useActiveMatch";
import { Link, useNavigate } from "react-router-dom";

interface AppHeaderProps {
  showNavMenu?: boolean;
  onNavSelect?: (value: string) => void;
  currentTab?: string;
  navItems?: Array<{ value: string; label: string; icon: React.ReactNode }>;
  onReturnToMatch?: () => void;
  hideReturnButton?: boolean;
}

const AppHeader = ({ showNavMenu, onNavSelect, currentTab, navItems, onReturnToMatch, hideReturnButton }: AppHeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { hasActiveMatch, activeMatchName } = useActiveMatch();
  const navigate = useNavigate();

  const handleReturnToMatch = () => {
    if (onReturnToMatch) {
      onReturnToMatch();
    } else {
      // Default behavior: navigate to home with active match
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-2">
        {/* Left: Logo */}
        <div className="flex items-center shrink-0">
          <Link to="/">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent via-accent-glow to-accent bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity">
              MatchPlay
            </h1>
          </Link>
        </div>
        
        {/* Right Section: Active Match + Hamburger + User Menu */}
        <div className="flex items-center gap-2 flex-1 md:flex-none justify-center md:justify-end">
          {hasActiveMatch && !hideReturnButton && (
            <Button
              variant="default"
              size="sm"
              onClick={handleReturnToMatch}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2"
            >
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Return to Active Match</span>
              <span className="sm:hidden">Active Match</span>
            </Button>
          )}
          
          {showNavMenu && navItems && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-accent hover:text-accent hover:bg-accent/10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[250px]">
                <div className="flex flex-col gap-2 mt-8">
                  {navItems.map((item) => (
                    <Button
                      key={item.value}
                      variant={currentTab === item.value ? "default" : "ghost"}
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        onNavSelect?.(item.value);
                        setMobileMenuOpen(false);
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </Button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
