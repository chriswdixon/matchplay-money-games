import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/utils/render";
import userEvent from "@testing-library/user-event";
import HeroThemeSwitcher, { applyHeroTheme, getStoredHeroTheme } from "@/components/HeroThemeSwitcher";

describe("HeroThemeSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("applyHeroTheme sets class and persists", () => {
    applyHeroTheme("green");
    expect(document.documentElement.classList.contains("theme-green")).toBe(true);
    expect(localStorage.getItem("tyche-hero-theme")).toBe("green");

    applyHeroTheme("teal");
    expect(document.documentElement.classList.contains("theme-teal")).toBe(true);
    expect(document.documentElement.classList.contains("theme-green")).toBe(false);
  });

  it("getStoredHeroTheme defaults to gold and reads valid value", () => {
    expect(getStoredHeroTheme()).toBe("gold");
    localStorage.setItem("tyche-hero-theme", "green");
    expect(getStoredHeroTheme()).toBe("green");
    localStorage.setItem("tyche-hero-theme", "bogus");
    expect(getStoredHeroTheme()).toBe("gold");
  });

  it("toggle button opens panel with all themes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HeroThemeSwitcher />);
    const trigger = screen.getByRole("button", { name: /toggle hero theme/i });
    await user.click(trigger);
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("Green")).toBeInTheDocument();
    expect(screen.getByText("Teal")).toBeInTheDocument();
  });

  it("selecting a theme applies it to documentElement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HeroThemeSwitcher />);
    await user.click(screen.getByRole("button", { name: /toggle hero theme/i }));
    await user.click(screen.getByRole("button", { name: /Green/i }));
    expect(document.documentElement.classList.contains("theme-green")).toBe(true);
  });
});
