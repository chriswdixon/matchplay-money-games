import { useNavigate } from 'react-router-dom';
import BottomTabBar from '@/components/home/BottomTabBar';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { HandicapCalculators } from '@/components/HandicapCalculators';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function HandicapCalculatorsPage() {
  const navigate = useNavigate();
  const { hasActiveMatch } = useActiveMatch();
  usePageMeta({
    title: 'Golf Handicap Calculators — Tyche',
    description:
      'Free course handicap and playing handicap calculators. Simplified USGA-style formulas, instant results, mobile-friendly for the course.',
    path: '/handicap-calculators',
  });
  return (
    <div className="app-page-bg pb-32 md:pb-12 md:pt-24">
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="page-card-shell">
          <HandicapCalculators />
        </div>
      </main>
      <BottomTabBar
        activeTab={"profile" as any}
        onChange={(tab) => {
          if (tab === 'profile') navigate('/profile');
          else if (tab === 'home') navigate('/');
          else navigate(`/?tab=${tab}`);
        }}
        hasActiveMatch={hasActiveMatch}
      />
    </div>
  );
}
