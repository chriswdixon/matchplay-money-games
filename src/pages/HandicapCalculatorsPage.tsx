import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { HandicapCalculators } from '@/components/HandicapCalculators';

export default function HandicapCalculatorsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="max-w-4xl mx-auto px-4 md:px-6 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back
        </Button>
      </header>
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <HandicapCalculators />
      </main>
    </div>
  );
}
