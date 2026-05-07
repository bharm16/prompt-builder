import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SignInPage } from "../SignInPage";
import { SignUpPage } from "../SignUpPage";

const mockUseAuthUser = vi.hoisted(() => vi.fn());
const authRepositoryMock = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  verifyEmailWithCode: vi.fn(),
  refreshCurrentUser: vi.fn(),
}));
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/utils/cn", () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
}));

vi.mock("@hooks/useAuthUser", () => ({
  useAuthUser: mockUseAuthUser,
}));

vi.mock("@repositories/index", () => ({
  getAuthRepository: () => authRepositoryMock,
}));

vi.mock("@components/Toast", () => ({
  useToast: () => toastMock,
}));

vi.mock("@promptstudio/system/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    children: React.ReactNode;
  }) => {
    if (asChild) {
      return (
        <span {...(props as React.HTMLAttributes<HTMLSpanElement>)}>
          {children}
        </span>
      );
    }
    return <button {...props}>{children}</button>;
  },
}));

/**
 * Regression: every text input on SignIn / SignUp pages must be reachable
 * via getByLabelText. Without proper label-input association, screen
 * readers cannot announce what each field collects, and Playwright's
 * getByLabel() locator (used in the auth e2e suite) silently breaks.
 *
 * Invariant: each visible label on the auth forms is associated with its
 * corresponding input either via htmlFor/id, by wrapping the input, or
 * via aria-label.
 */
describe("regression: auth pages are reachable by accessible labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthUser.mockReturnValue(null);
  });

  it("sign-in form: email and password inputs are label-reachable", () => {
    render(
      <MemoryRouter initialEntries={["/signin"]}>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const email = screen.getByLabelText(/email/i);
    expect(email).toBeInstanceOf(HTMLInputElement);
    expect((email as HTMLInputElement).type).toBe("email");

    const password = screen.getByLabelText(/^password$/i);
    expect(password).toBeInstanceOf(HTMLInputElement);
    expect((password as HTMLInputElement).type).toBe("password");
  });

  it("sign-up form: name, email, password, and confirm inputs are label-reachable", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const name = screen.getByLabelText(/name/i);
    expect(name).toBeInstanceOf(HTMLInputElement);

    const email = screen.getByLabelText(/email/i);
    expect(email).toBeInstanceOf(HTMLInputElement);
    expect((email as HTMLInputElement).type).toBe("email");

    const password = screen.getByLabelText(/^password$/i);
    expect(password).toBeInstanceOf(HTMLInputElement);
    expect((password as HTMLInputElement).type).toBe("password");

    const confirm = screen.getByLabelText(/confirm/i);
    expect(confirm).toBeInstanceOf(HTMLInputElement);
    expect((confirm as HTMLInputElement).type).toBe("password");
  });
});
