// Adds DOM matchers like toBeInTheDocument() to every test's expect().
import "@testing-library/jest-dom";
// Adds toHaveNoViolations() for the axe accessibility checks.
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);
