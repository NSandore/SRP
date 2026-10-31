import React, { useEffect, useRef, useState } from 'react';
import { FaArrowRight, FaCompass, FaShieldAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './OnboardingBanner.css';
import VerificationComparison from './VerificationComparison';

export const isOnboardingIncomplete = (onboarding) =>
  Boolean(onboarding) && onboarding.status !== 'completed';

const onboardingMessage = (step) => {
  if (Number(step) === 1) return 'Confirm your email, then choose what kind of guidance would help.';
  if (Number(step) === 2) return 'Tell us what brings you here so your starting point fits you.';
  return 'Choose the topics and schools you want help navigating.';
};

export const shouldPromptIdentityVerification = (userData, onboarding) => {
  if (!userData || Number(userData.verified) === 1) return false;
  const educationStatus = String(userData.education_status || '').toLowerCase();
  const eligible = educationStatus.includes('student') || educationStatus.includes('staff');
  if (!eligible) return false;
  const verification = onboarding?.verification || {};
  return !Object.values(verification).some((request) => request?.status === 'pending');
};

function OnboardingBanner({ onboarding, userData, onResume }) {
  const navigate = useNavigate();
  const [showVerificationInfo, setShowVerificationInfo] = useState(false);
  const startButtonRef = useRef(null);
  const onboardingIncomplete = isOnboardingIncomplete(onboarding);
  const showVerificationPrompt = !onboardingIncomplete && shouldPromptIdentityVerification(userData, onboarding);

  useEffect(() => {
    if (!showVerificationInfo) return undefined;
    startButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowVerificationInfo(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showVerificationInfo]);

  if (!onboardingIncomplete && !showVerificationPrompt) return null;

  return (
    <>
      <aside className={`onboarding-banner${showVerificationPrompt ? ' onboarding-banner--verification' : ''}`} aria-label={onboardingIncomplete ? 'Incomplete account setup' : 'Identity verification available'}>
        <span className="onboarding-banner__icon" aria-hidden="true">{onboardingIncomplete ? <FaCompass /> : <FaShieldAlt />}</span>
        <div className="onboarding-banner__copy">
          <strong>{onboardingIncomplete ? 'Finish setting up your account' : 'Add a verified school connection'}</strong>
          <span>{onboardingIncomplete ? onboardingMessage(onboarding.current_step) : 'Get verified to add a reviewed badge and help others trust your student or staff affiliation.'}</span>
        </div>
        <button type="button" className="onboarding-banner__action" onClick={onboardingIncomplete ? onResume : () => setShowVerificationInfo(true)}>
          {onboardingIncomplete ? 'Resume onboarding' : 'Get verified'} <FaArrowRight aria-hidden="true" />
        </button>
      </aside>
      {showVerificationInfo && (
        <div className="verification-prompt-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowVerificationInfo(false); }}>
          <section className="verification-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="verification-prompt-title">
            <div className="verification-prompt-heading">
              <span><FaShieldAlt aria-hidden /> Optional identity verification</span>
              <h2 id="verification-prompt-title">What verification changes</h2>
              <p>Submit proof of your student or staff connection for review. You can keep using StudentSphere while the request is pending.</p>
            </div>
            <VerificationComparison compact />
            <div className="verification-prompt-actions">
              <button type="button" className="onboarding-banner__action onboarding-banner__action--secondary" onClick={() => setShowVerificationInfo(false)}>Maybe later</button>
              <button ref={startButtonRef} type="button" className="onboarding-banner__action" onClick={() => navigate('/signup?verify=1')}>Start verification <FaArrowRight aria-hidden /></button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default OnboardingBanner;
