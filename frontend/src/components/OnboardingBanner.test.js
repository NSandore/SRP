import { fireEvent, render, screen } from '@testing-library/react';
import OnboardingBanner, { isOnboardingIncomplete } from './OnboardingBanner';

describe('OnboardingBanner', () => {
  test('renders the saved next step and resumes onboarding', () => {
    const onResume = jest.fn();
    render(<OnboardingBanner onboarding={{ status: 'paused', current_step: 3 }} onResume={onResume} />);

    expect(screen.getByText(/topics and schools/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /resume onboarding/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  test('does not render after onboarding is complete', () => {
    const { container } = render(<OnboardingBanner onboarding={{ status: 'completed', current_step: 9 }} />);
    expect(container).toBeEmptyDOMElement();
    expect(isOnboardingIncomplete(null)).toBe(false);
  });
});
