import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils/render";
import AppFooter from "@/components/AppFooter";

vi.mock("@/hooks/useAyrshareProfiles", () => ({
  useAyrshareProfiles: () => ({ connectedPlatforms: ["facebook", "x"], loading: false }),
}));

describe("AppFooter", () => {
  it("renders copyright with current year", () => {
    renderWithProviders(<AppFooter />);
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Tyche`))).toBeInTheDocument();
  });

  it("renders Terms, Privacy, Support links", () => {
    renderWithProviders(<AppFooter />);
    expect(screen.getByRole("link", { name: /Terms of Service/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Privacy Policy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Support/i })).toHaveAttribute("href", "mailto:support@match-play.co");
  });

  it("legal links use accent (green) color classes", () => {
    renderWithProviders(<AppFooter />);
    const terms = screen.getByRole("link", { name: /Terms of Service/i }).closest("a");
    // accent class is on parent button — walk up
    const btn = terms!.closest('[class*="text-accent"]') ?? terms!;
    expect(btn.className).toMatch(/text-accent/);
  });

  it("renders connected social platforms with correct hrefs", () => {
    renderWithProviders(<AppFooter />);
    expect(screen.getByRole("link", { name: /Follow us on facebook/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Follow us on x/i })).toBeInTheDocument();
  });

  it("uses contentinfo landmark", () => {
    renderWithProviders(<AppFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
