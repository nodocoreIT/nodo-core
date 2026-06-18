import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { GlobalSearchInput, useSearchStore } from "@nodocore/shared-components";

describe("GlobalSearchInput", () => {
  beforeEach(() => useSearchStore.setState({ query: "" }));

  it("renders with the given placeholder", () => {
    render(<GlobalSearchInput placeholder="Buscar propiedades…" />);
    expect(
      screen.getByRole("searchbox", { name: /buscar propiedades/i }),
    ).toBeInTheDocument();
  });

  it("writes typed text to the shared search store", async () => {
    render(<GlobalSearchInput placeholder="Buscar…" />);
    await userEvent.type(screen.getByRole("searchbox"), "lavalle");
    expect(useSearchStore.getState().query).toBe("lavalle");
  });

  it("reflects the current store value", () => {
    useSearchStore.setState({ query: "preset" });
    render(<GlobalSearchInput placeholder="Buscar…" />);
    expect(screen.getByRole("searchbox")).toHaveValue("preset");
  });
});
