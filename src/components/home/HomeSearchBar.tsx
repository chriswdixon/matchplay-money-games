import { Search } from "lucide-react";
import { useId } from "react";

interface HomeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HomeSearchBar = ({ value, onChange, placeholder }: HomeSearchBarProps) => {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <div className="flex items-center gap-3 bg-primary text-primary-foreground rounded-full pl-5 pr-4 h-14 shadow-premium">
        <Search className="w-5 h-5 shrink-0" aria-hidden="true" />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Search for a course, city, or zip code."}
          className="flex-1 bg-transparent border-0 outline-none placeholder:text-primary-foreground/80 text-base"
        />
      </div>
    </div>
  );
};

export default HomeSearchBar;
