import React from 'react';
import { FaArrowRight, FaCompass } from 'react-icons/fa';
import './OnboardingBanner.css';

export const isOnboardingIncomplete = (onboarding) =>
  Boolean(onboarding) && onboarding.status !== 'completed';

const onboardingMessage = (step) => {
  if (Number(step) === 1) return 'Confirm your email, then choose what kind of guidance would help.';
  if (Number(step) === 2) return 'Tell us what brings you here so your starting point fits you.';
  return 'Choose the topics and schools you want help navigating.';
};

function OnboardingBanner({ onboarding, onResume }) {
  if (!isOnboardingIncomplete(onboarding)) return null;

  return (
    <aside className="onboarding-banner" aria-label="Incomplete account setup">
      <span className="onboarding-banner__icon" aria-hidden="true"><FaCompass /></span>
      <div className="onboarding-banner__copy">
        <strong>Finish setting up your account</strong>
        <span>{onboardingMessage(onboarding.current_step)}</span>
      </div>
      <button type="button" className="onboarding-banner__action" onClick={onResume}>
        Resume onboarding <FaArrowRight aria-hidden="true" />
      </button>
    </aside>
  );
}

export default OnboardingBanner;
