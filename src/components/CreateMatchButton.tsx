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
          navigate('/create-match');
        }
      }}
    >
      <Plus className="w-4 h-4 mr-2" />
      {user ? 'Create Match' : 'Sign In to Create Match'}
    </Button>
  );
};

export default CreateMatchButton;
