import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

// The real page uses the browser repository (jsdom's localStorage), which loads just after
// mounting. Each test waits for that with a findBy… query.
afterEach(() => window.localStorage.clear());

describe("Home page", () => {
  it("shows the app name as the main heading", async () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "Sipat" })).toBeInTheDocument();
    await screen.findByText(/No focus sessions yet/);
  });

  it("starts on a 25-minute focus session, ready to start, with an empty log", async () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 2, name: "Focus" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("25:00");
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(await screen.findByText(/No focus sessions yet/)).toBeInTheDocument();
  });
});
