import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { AccountBalance } from '@/components/profile/AccountBalance';
import { TransactionHistory } from '@/components/profile/TransactionHistory';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import { PasswordVerificationDialog } from '@/components/auth/PasswordVerificationDialog';
import BottomTabBar from '@/components/home/BottomTabBar';
import { PageTitleCard } from '@/components/ui/page-title-card';
import { Landmark } from 'lucide-react';

export default function Wallet() {
  const { user, loading } = useAuth();
  const { hasActiveMatch } = useActiveMatch();
  const navigate = useNavigate();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true });
  }, [user, loading, navigate]);

  // 15-minute grace window so users browsing their own balance aren't re-prompted constantly.
  useEffect(() => {
    if (!user) return;
    const key = `tyche-wallet-verified-${user.id}`;
    const ts = Number(sessionStorage.getItem(key) || 0);
    if (ts && Date.now() - ts < 15 * 60 * 1000) {
      setIsVerified(true);
    } else if (!isVerified) {
      setShowPasswordDialog(true);
    }
  }, [user, isVerified]);

  if (loading) {
    return (
      <div className="app-page-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app-page-bg flex flex-col">
      <a href="#wallet-main" className="skip-link">Skip to main content</a>

      <header className="px-4 md:px-6 pt-4 max-w-3xl w-full mx-auto md:pt-20" role="banner">
        <PageTitleCard
          icon={<Landmark className="w-5 h-5" aria-hidden="true" />}
          title="Wallet & Membership"
          description="Track your play money, see every transaction, and manage your membership tier."
        />
      </header>

      <main
        id="wallet-main"
        role="main"
        className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-6 pt-8 md:pt-10 pb-32 md:pb-12"
      >
        {isVerified ? (
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
        ) : (
          <div className="page-card-shell text-center space-y-2">
            <p className="text-base font-semibold">Verify your password to continue</p>
            <p className="text-sm text-muted-foreground">
              For your security, we need to confirm it's you before showing your balance, transactions, and membership details.
            </p>
          </div>
        )}
      </main>

      <BottomTabBar
        activeTab="wallet"
        onChange={(tab) => {
          if (tab === 'wallet') return;
          if (tab === 'home') navigate('/');
          else if (tab === 'profile') navigate('/profile');
          else navigate(`/?tab=${tab}`);
        }}
        hasActiveMatch={hasActiveMatch}
      />

      <PasswordVerificationDialog
        open={showPasswordDialog}
        onVerified={() => {
          setIsVerified(true);
          setShowPasswordDialog(false);
          if (user) {
            sessionStorage.setItem(`tyche-wallet-verified-${user.id}`, String(Date.now()));
          }
        }}
        onCancel={() => {
          setShowPasswordDialog(false);
          if (!isVerified) navigate('/profile');
        }}
        title="Verify Your Password"
        description="For security, please verify your password to access your wallet and subscription details."
      />
    </div>
  );
}
