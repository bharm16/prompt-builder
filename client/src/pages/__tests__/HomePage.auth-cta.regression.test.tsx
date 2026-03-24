/**
 * Regression test: /home hero CTA hides "Create account" for authenticated users.
 *
 * Previously, the HomePage rendered "Create account" unconditionally, even
 * when the user was already signed in. The hero now conditionally hides the
 * signup CTA when useAuthUser returns a user object.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from '../HomePage';

const mockUseAuthUser = vi.hoisted(() => vi.fn());

vi.mock('@hooks/useAuthUser', () => ({
  useAuthUser: mockUseAuthUser,
}));

describe('regression: HomePage auth-conditional CTA', () => {
  it('hides "Create account" when user is authenticated', () => {
    mockUseAuthUser.mockReturnValue({ uid: 'user-1', email: 'test@test.com' });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Open workspace')).toBeTruthy();
    expect(screen.queryByText('Create account')).toBeNull();
  });

  it('shows "Create account" when user is not authenticated', () => {
    mockUseAuthUser.mockReturnValue(null);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Open workspace')).toBeTruthy();
    expect(screen.getByText('Create account')).toBeTruthy();
  });
});
