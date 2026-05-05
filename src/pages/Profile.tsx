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

  const ActionIcons = () => (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center flex-wrap justify-end gap-1.5">
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
                    'relative flex items-center justify-center rounded-full transition-all w-9 h-9 shrink-0 border',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  )}
                >
                  <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  {badge && badge > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-card"
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

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

        {hasActiveMatch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="Active Match"
                className="flex items-center justify-center rounded-full w-9 h-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Target className="w-4 h-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Active Match</TooltipContent>
          </Tooltip>
        )}

        {isAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setAdminConfirmOpen(true)}
                aria-label="Admin Portal"
                className="relative flex items-center justify-center rounded-full w-9 h-9 shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                {openSupportCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-background text-destructive text-[10px] font-bold leading-none flex items-center justify-center border-2 border-card"
                  >
                    {openSupportCount > 99 ? '99+' : openSupportCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Admin Portal</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShowSupportDialog(true)}
              aria-label="Contact Support"
              className="flex items-center justify-center rounded-full w-9 h-9 shrink-0 bg-success text-success-foreground hover:bg-success/90"
            >
              <LifeBuoy className="w-4 h-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Contact Support</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              aria-label="Log out"
              className="flex items-center justify-center rounded-full w-9 h-9 shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Log out</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-start justify-between gap-3 pb-4 border-b">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-gradient-primary rounded-lg shrink-0">
          <User className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold leading-none truncate">{title}</h2>
      </div>
      <ActionIcons />
    </div>
  );

  return (
    <div className="app-page-bg flex flex-col">
      <a href="#profile-main" className="skip-link">Skip to main content</a>

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
        className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-6 pt-8 md:pt-28 pb-32 md:pb-12"
      >
        <div className="space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="page-card-shell space-y-6">
                <SectionHeader title="Profile" />
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
              <div className="page-card-shell space-y-6">
                <SectionHeader title="Account & Subscription" />
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
            <div className="page-card-shell space-y-6">
              <SectionHeader title="Notifications" />
              <NotificationsPanel />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="page-card-shell space-y-6">
                <SectionHeader title="Settings" />
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
