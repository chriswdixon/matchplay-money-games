import { UserMenu } from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

interface AppHeaderProps {
  showNavMenu?: boolean;
  onNavSelect?: (value: string) => void;
  currentTab?: string;
  navItems?: Array<{ value: string; label: string; icon: React.ReactNode }>;
}

const AppHeader = ({ showNavMenu, onNavSelect, currentTab, navItems }: AppHeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          {showNavMenu && navItems && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-accent hover:text-accent hover:bg-accent/10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[250px]">
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
          <h1 className="text-2xl font-bold bg-gradient-to-r from-accent via-accent-glow to-accent bg-clip-text text-transparent">
            MatchPlay
          </h1>
        </div>
        
        <UserMenu />
      </div>
    </header>
  );
};

export default AppHeader;
