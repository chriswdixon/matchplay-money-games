import { UserMenu } from "@/components/auth/UserMenu";

const AppHeader = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
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
