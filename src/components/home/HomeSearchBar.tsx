import { Search } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";

interface HomeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HomeSearchBar = ({ value, onChange, placeholder }: HomeSearchBarProps) => {
  const id = useId();
  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search courses near you"}
        className="pl-10 h-11"
        aria-label="Search courses near you"
      />
    </div>
  );
};

export default HomeSearchBar;
