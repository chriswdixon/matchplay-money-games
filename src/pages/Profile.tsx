import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFreeTier } from '@/hooks/useFreeTier';
import { ProfileDisplay } from '@/components/profile/ProfileDisplay';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Settings, CreditCard, Target, Shield, DollarSign, FileText, Trophy } from 'lucide-react';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import { MFASettings } from '@/components/profile/MFASettings';
import { AccountBalance } from '@/components/profile/AccountBalance';
import { TransactionHistory } from '@/components/profile/TransactionHistory';
import { PasswordVerificationDialog } from '@/components/auth/PasswordVerificationDialog';
import { GDPRSettings } from '@/components/profile/GDPRSettings';
import { AppearanceSettings } from '@/components/profile/AppearanceSettings';
import { cn } from '@/lib/utils';

const HandicapSettings = lazy(() =>
  import('@/components/profile/HandicapSettings').then(m => ({ default: m.HandicapSettings }))
);

type TabId = 'profile' | 'handicap' | 'account' | 'settings' | 'security' | 'subscription' | 'privacy';

export default function Profile() {
  const { user, loading } = useAuth();
  const { hasActiveMatch } = useActiveMatch();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { hasAccess } = useFreeTier();

  const [activeTab, setActiveTab] = useState<TabId>('profile');
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
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  const handleTabChange = (value: TabId) => {
    if ((value === 'account' || value === 'subscription') && !isVerified) {
      setPendingTab(value);
      setShowPasswordDialog(true);
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

  const tabs: { id: TabId; label: string; Icon: typeof User; show: boolean }[] = [
    { id: 'profile', label: 'Profile', Icon: User, show: true },
    { id: 'handicap', label: 'Handicap', Icon: Trophy, show: true },
    { id: 'account', label: 'Account', Icon: DollarSign, show: showAccountTab },
    { id: 'settings', label: 'Settings', Icon: Settings, show: true },
    { id: 'security', label: 'Security', Icon: Shield, show: true },
    { id: 'subscription', label: 'Subscription', Icon: CreditCard, show: true },
    { id: 'privacy', label: 'Privacy', Icon: FileText, show: true },
  ].filter(t => t.show);

  const Toolbar = () => (
    <nav
      aria-label="Profile sections"
      className={cn(
        'z-40 px-2 pointer-events-none',
        isMobile
          ? 'fixed left-0 right-0 bottom-0 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3'
          : 'sticky top-4 mb-6'
      )}
    >
      <div className="mx-auto max-w-3xl pointer-events-auto">
        <div
          className={cn(
            'flex items-center gap-1 bg-foreground text-background rounded-full px-2 py-2 shadow-premium overflow-x-auto scrollbar-hide',
            isMobile ? 'justify-between' : 'justify-start'
          )}
        >
          {tabs.map(({ id, label, Icon }) => {
            const active = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2 rounded-full transition-all px-3 h-10 shrink-0',
                  active
                    ? 'bg-primary text-primary-foreground shadow-accent'
                    : 'text-background/90 hover:text-background hover:bg-background/10'
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                {!isMobile && <span className="text-sm font-medium">{label}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <a href="#profile-main" className="skip-link">Skip to main content</a>

      {/* Top utility bar */}
      <header className="px-4 md:px-6 pt-4 max-w-3xl w-full mx-auto" role="banner">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {!isMobile && 'Back to Home'}
          </Button>

          {hasActiveMatch && (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Return to Active Match</span>
              <span className="sm:hidden">Active Match</span>
            </Button>
          )}

          <div className="flex-1">
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your Tyche profile and preferences</p>
          </div>
        </div>
      </header>

      <main
        id="profile-main"
        role="main"
        className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-6 pt-4 pb-32 md:pb-12"
      >
        {!isMobile && <Toolbar />}

        <div className="space-y-6">
          {activeTab === 'profile' && (
            <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
              <ProfileDisplay />
            </div>
          )}

          {activeTab === 'handicap' && (
            <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
              <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading...</div>}>
                <HandicapSettings />
              </Suspense>
            </div>
          )}

          {activeTab === 'account' && showAccountTab && (
            <div className="space-y-6">
              <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
                <AccountBalance />
              </div>
              <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
                <TransactionHistory />
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
                <AppearanceSettings />
              </div>
              <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
                <ProfileForm />
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
              <MFASettings />
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
              <SubscriptionManagement
                isVerified={isVerified}
                onRequestVerification={() => setShowPasswordDialog(true)}
              />
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="bg-card rounded-3xl p-4 md:p-6 shadow-card">
              <GDPRSettings />
            </div>
          )}
        </div>
      </main>

      {isMobile && <Toolbar />}

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
