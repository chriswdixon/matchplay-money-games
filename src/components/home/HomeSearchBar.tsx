import { Search } from "lucide-react";
import { useId, useRef } from "react";

interface HomeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HomeSearchBar = ({ value, onChange, placeholder }: HomeSearchBarProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <div
        onClick={() => inputRef.current?.focus()}
        className="relative bg-primary text-primary-foreground rounded-full h-14 shadow-premium cursor-text"
      >
        <Search
          className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Search for a course, city, or zip code"}
          className="absolute inset-0 w-full h-full bg-transparent border-0 outline-none pl-14 pr-5 rounded-full placeholder:text-primary-foreground/80 text-base"
        />
      </div>
    </div>
  );
};

export default HomeSearchBar;
