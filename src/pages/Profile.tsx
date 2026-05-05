import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFreeTier } from '@/hooks/useFreeTier';
import { ProfileDisplay } from '@/components/profile/ProfileDisplay';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User, Settings, CreditCard, Target, Shield, DollarSign, FileText, Trophy, ShieldCheck, Bell, LifeBuoy, LogOut } from 'lucide-react';
import { SupportRequestDialog } from '@/components/profile/SupportRequestDialog';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useOpenSupportRequestsCount } from '@/hooks/useOpenSupportRequestsCount';
import { PageTitleCard } from '@/components/ui/page-title-card';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import { MFASettings } from '@/components/profile/MFASettings';
import { ChangePassword } from '@/components/profile/ChangePassword';
import { AccountBalance } from '@/components/profile/AccountBalance';
import { TransactionHistory } from '@/components/profile/TransactionHistory';
import { PasswordVerificationDialog } from '@/components/auth/PasswordVerificationDialog';
import { GDPRSettings } from '@/components/profile/GDPRSettings';
import { AppearanceSettings } from '@/components/profile/AppearanceSettings';
import { NotificationsPanel } from '@/components/profile/NotificationsPanel';
import { useNotifications } from '@/hooks/useNotifications';
import BottomTabBar from '@/components/home/BottomTabBar';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const HandicapSettings = lazy(() =>
  import('@/components/profile/HandicapSettings').then(m => ({ default: m.HandicapSettings }))
);

type TabId = 'profile' | 'account' | 'notifications' | 'settings';

export default function Profile() {
  const { user, loading, signOut } = useAuth();
  const { hasActiveMatch } = useActiveMatch();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { hasAccess } = useFreeTier();
  const { isAdmin } = useAdminRole();
  const { count: openSupportCount } = useOpenSupportRequestsCount();
  const { unreadCount } = useNotifications();

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [adminTooltipOpen, setAdminTooltipOpen] = useState(false);
  const [adminConfirmOpen, setAdminConfirmOpen] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const showAccountTab = hasAccess('account_tab');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="app-page-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  const handleTabChange = (value: TabId) => {
    if (value === 'account') {
      navigate('/wallet');
      return;
    }
    setActiveTab(value);
  };

  const handlePasswordVerified = () => {
    setIsVerified(true);
    setShowPasswordDialog(false);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordDialog(false);
    setPendingTab(null);
  };

  const allTabs: { id: TabId; label: string; Icon: typeof User; show: boolean; badge?: number }[] = [
    { id: 'profile', label: 'Profile & Handicap', Icon: User, show: true },
    { id: 'account', label: 'Account & Subscription', Icon: DollarSign, show: showAccountTab },
    { id: 'notifications', label: 'Notifications', Icon: Bell, show: true, badge: unreadCount },
    { id: 'settings', label: 'Settings', Icon: Settings, show: true },
  ];
  const tabs = allTabs.filter(t => t.show);

  const SectionTabs = () => (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Profile sections"
        className={cn(
          'z-30 px-2 pointer-events-none',
          isMobile
            ? 'sticky top-2 mt-4 mb-6'
            : 'sticky top-4 mt-6 mb-8'
        )}
      >
        <div className="mx-auto w-3/4 max-w-md pointer-events-auto">
          <div className="flex items-center justify-around gap-1 bg-foreground text-background rounded-full px-2 py-2 shadow-premium border border-border">
            {tabs.map(({ id, label, Icon, badge }) => {
              const active = id === activeTab;
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleTabChange(id)}
                      aria-label={badge ? `${label} (${badge} unread)` : label}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center justify-center rounded-full transition-all w-10 h-10 shrink-0',
                        active
                          ? 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.6)]'
                          : 'text-background/90 hover:text-background hover:bg-background/10 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]'
                      )}
                    >
                      <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                      {badge && badge > 0 ? (
                        <span
                          aria-hidden="true"
                          className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-foreground"
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      ) : null}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );

  return (
    <div className="app-page-bg flex flex-col">
      <a href="#profile-main" className="skip-link">Skip to main content</a>

      <header className="px-4 md:px-6 pt-4 max-w-3xl w-full mx-auto md:pt-20" role="banner">
        <PageTitleCard
          icon={<User className="w-5 h-5" aria-hidden="true" />}
          title="Profile"
        />
      </header>

      <AlertDialog open={adminConfirmOpen} onOpenChange={setAdminConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enter Admin Console?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to access the Admin Console, where you can manage users,
              matches, coupons, and support requests. All admin actions are logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAdminConfirmOpen(false);
                navigate('/admin');
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continue to Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main
        id="profile-main"
        role="main"
        className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-6 pt-4 pb-32 md:pb-12"
      >
        <SectionTabs />

        <div className="space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="page-card-shell space-y-6">
                <ProfileDisplay />
                <div className="border-t pt-6">
                  <ProfileForm />
                </div>
              </div>
              <div className="page-card-shell">
                <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading...</div>}>
                  <HandicapSettings />
                </Suspense>
              </div>
            </div>
          )}

          {activeTab === 'account' && showAccountTab && (
            <div className="space-y-6">
              <div className="page-card-shell">
                <AccountBalance />
              </div>
              <div className="page-card-shell">
                <TransactionHistory />
              </div>
              <div className="page-card-shell">
                <SubscriptionManagement
                  isVerified={isVerified}
                  onRequestVerification={() => setShowPasswordDialog(true)}
                />
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="page-card-shell">
              <NotificationsPanel />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="page-card-shell">
                <AppearanceSettings />
              </div>
              <div className="page-card-shell">
                <ChangePassword />
              </div>
              <div className="page-card-shell">
                <MFASettings />
              </div>
              <div className="page-card-shell">
                <GDPRSettings />
              </div>
            </div>
          )}
        </div>
      </main>

      <BottomTabBar
        activeTab="profile"
        onChange={(tab) => {
          if (tab === 'profile') return;
          if (tab === 'home') navigate('/');
          else navigate(`/?tab=${tab}`);
        }}
        hasActiveMatch={hasActiveMatch}
      />

      <SupportRequestDialog open={showSupportDialog} onOpenChange={setShowSupportDialog} />

      <PasswordVerificationDialog
        open={showPasswordDialog}
        onVerified={handlePasswordVerified}
        onCancel={handlePasswordCancel}
        title="Verify Your Password"
        description="For security, please verify your password to access sensitive account information."
      />
    </div>
  );
}
