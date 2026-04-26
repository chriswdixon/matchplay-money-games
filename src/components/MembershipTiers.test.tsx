import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, within } from "@/test/utils/render";
import { mockNavigate } from "@/test/utils/mockNavigation";
import userEvent from "@testing-library/user-event";
import MembershipTiers from "@/components/MembershipTiers";

describe("MembershipTiers", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("renders all three tiers", () => {
    renderWithProviders(<MembershipTiers />);
    expect(screen.getByText(/Free/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Player/i)).toBeInTheDocument();
    expect(screen.getByText(/Global Player/i)).toBeInTheDocument();
  });

  it("shows Most Popular badge on the popular tier", () => {
    renderWithProviders(<MembershipTiers />);
    expect(screen.getByText(/Most Popular/i)).toBeInTheDocument();
  });

  it("renders all Start buttons", () => {
    renderWithProviders(<MembershipTiers />);
    const buttons = screen.getAllByRole("button", { name: /Start/i });
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("Start Free navigates to /auth", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MembershipTiers />);
    await user.click(screen.getByRole("button", { name: /Start Free/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/auth");
  });

  it("paid tier navigates to /auth with tier+billing query", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MembershipTiers />);
    const startLocal = screen.getByRole("button", { name: /Start Local Play/i });
    await user.click(startLocal);
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("/auth?tier=local"));
  });

  it("buttons share the same DOM-bottom alignment within their cards", () => {
    const { container } = renderWithProviders(<MembershipTiers />);
    const cards = container.querySelectorAll('[class*="flex-col"][class*="h-full"]');
    expect(cards.length).toBeGreaterThanOrEqual(3);
    cards.forEach((card) => {
      const footer = card.querySelector('[class*="mt-auto"]');
      expect(footer).not.toBeNull();
    });
  });

  it("popular tier has primary border emphasis", () => {
    const { container } = renderWithProviders(<MembershipTiers />);
    const popularCard = within(container as HTMLElement).getByText(/Most Popular/i).closest('[class*="border-primary"]');
    expect(popularCard).not.toBeNull();
  });
});
