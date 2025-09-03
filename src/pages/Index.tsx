import MatchPlayLanding from "./MatchPlayLanding";
import PasswordGate from "@/components/PasswordGate";

const Index = () => {
  return (
    <PasswordGate>
      <MatchPlayLanding />
    </PasswordGate>
  );
};

export default Index;
