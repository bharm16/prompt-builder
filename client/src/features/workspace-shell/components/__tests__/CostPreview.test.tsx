import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CostPreview } from "../CostPreview";

describe("CostPreview", () => {
  it("renders the cost in 'X cr / shot' format", () => {
    render(<CostPreview cost={22} />);
    expect(screen.getByText(/22.*cr.*shot/i)).toBeInTheDocument();
  });

  it("returns null when cost is 0", () => {
    const { container } = render(<CostPreview cost={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("uses font-mono styling", () => {
    const { container } = render(<CostPreview cost={5} />);
    expect((container.firstChild as HTMLElement).className).toMatch(
      /font-mono/,
    );
  });
});
