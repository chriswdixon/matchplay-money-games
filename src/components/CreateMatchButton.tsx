import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const CreateMatchButton = ({ onMatchCreated }: { onMatchCreated?: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Button 
      className="bg-gradient-primary text-primary-foreground hover:shadow-premium"
      onClick={() => {
        if (!user) {
          navigate('/auth');
        } else {
          // Matches must start from a selected course — send users to the
          // course search first so they can pick one before creating.
          navigate('/?tab=matches');
        }
      }}
    >
      {user ? 'Create Match' : 'Sign In to Create Match'}
    </Button>
  );
};

export default CreateMatchButton;
