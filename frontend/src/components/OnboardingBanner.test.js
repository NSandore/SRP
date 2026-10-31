import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OnboardingBanner, { hasPendingIdentityVerification, isOnboardingIncomplete, shouldPromptIdentityVerification } from './OnboardingBanner';

const renderBanner = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('OnboardingBanner', () => {
  test('renders the saved next step and resumes onboarding', () => {
    const onResume = jest.fn();
    renderBanner(<OnboardingBanner onboarding={{ status: 'paused', current_step: 3 }} onResume={onResume} />);

    expect(screen.getByText(/topics and schools/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /resume onboarding/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  test('does not render after onboarding is complete', () => {
    const { container } = renderBanner(<OnboardingBanner onboarding={{ status: 'completed', current_step: 9 }} />);
    expect(container).toBeEmptyDOMElement();
    expect(isOnboardingIncomplete(null)).toBe(false);
  });

  test('offers eligible unverified users an accurate comparison', () => {
    renderBanner(
      <OnboardingBanner
        onboarding={{ status: 'completed', current_step: 9, verification: {} }}
        userData={{ education_status: 'Student', verified: 0 }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /get verified/i }));
    expect(screen.getByRole('dialog', { name: /what verification changes/i })).toBeInTheDocument();
    expect(screen.getByText(/does not grant moderation/i)).toBeInTheDocument();
  });

  test('does not prompt verified users or users with a pending review', () => {
    expect(shouldPromptIdentityVerification({ education_status: 'Student', verified: 1 }, {})).toBe(false);
    expect(shouldPromptIdentityVerification(
      { education_status: 'Student', verified: 0 },
      { verification: { student: { status: 'pending' } } }
    )).toBe(false);
  });

  test('shows a pending status after setup while review is underway', () => {
    const userData = { education_status: 'Student', verified: 0 };
    const onboarding = {
      status: 'completed',
      current_step: 9,
      verification: { student: { status: 'pending' } },
    };
    renderBanner(<OnboardingBanner onboarding={onboarding} userData={userData} />);

    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get verified/i })).not.toBeInTheDocument();
    expect(hasPendingIdentityVerification(userData, onboarding)).toBe(true);
  });
});
