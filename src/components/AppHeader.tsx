import { UserMenu } from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Target, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useActiveMatch } from "@/hooks/useActiveMatch";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";

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
  const { theme, setTheme } = useTheme();
  
  // Get the actual applied theme (handles system theme)
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const handleReturnToMatch = () => {
    if (onReturnToMatch) {
      onReturnToMatch();
    } else {
      // Default behavior: navigate to home with active match
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-[env(safe-area-inset-top)]">
      <div className="flex h-16 items-center gap-2 px-4 md:container md:justify-between">
        {/* Left: Logo */}
        <div className="flex items-center shrink-0">
          <Link to="/" className="flex items-center">
            <img 
              src={isDark ? logoDark : logoLight} 
              alt="MatchPlay" 
              className="h-10 w-auto hover:opacity-80 transition-opacity"
            />
          </Link>
        </div>
        
        {/* Right Section: Active Match + Hamburger + User Menu */}
        <div className="flex items-center gap-1 md:gap-2 ml-auto shrink-0">
          {hasActiveMatch && !hideReturnButton && (
            <Button
              variant="default"
              size="sm"
              onClick={handleReturnToMatch}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-1 md:gap-2"
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
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative z-50 min-w-[44px] min-h-[44px] touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
