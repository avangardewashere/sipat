import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("shows the app name as the main heading", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "Sipat" })).toBeInTheDocument();
  });

  it("shows a 25-minute focus timer ready to start", () => {
    render(<Home />);

    expect(screen.getByRole("timer")).toHaveTextContent("25:00");
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });
});
