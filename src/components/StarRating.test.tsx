import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils/render";
import userEvent from "@testing-library/user-event";
import StarRating from "@/components/StarRating";

describe("StarRating", () => {
  it("renders maxRating buttons", () => {
    renderWithProviders(<StarRating rating={3} />);
    expect(screen.getAllByRole("button").length).toBe(5);
  });

  it("respects custom maxRating", () => {
    renderWithProviders(<StarRating rating={2} maxRating={10} />);
    expect(screen.getAllByRole("button").length).toBe(10);
  });

  it("displays numeric rating when > 0", () => {
    renderWithProviders(<StarRating rating={4.5} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("hides numeric label when rating is 0", () => {
    renderWithProviders(<StarRating rating={0} />);
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
  });

  it("non-interactive buttons are disabled", () => {
    renderWithProviders(<StarRating rating={2} />);
    screen.getAllByRole("button").forEach((b) => expect(b).toBeDisabled());
  });

  it("interactive: fires onRatingChange with star value", async () => {
    const onRatingChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<StarRating rating={0} interactive onRatingChange={onRatingChange} />);
    await user.click(screen.getByRole("button", { name: "4 stars" }));
    expect(onRatingChange).toHaveBeenCalledWith(4);
  });

  it("singular vs plural aria labels", () => {
    renderWithProviders(<StarRating rating={1} />);
    expect(screen.getByRole("button", { name: "1 star" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 stars" })).toBeInTheDocument();
  });
});
