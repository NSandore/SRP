import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import { buildApiUrl } from '../utils/apiBase';
import './ProductTour.css';

/**
 * Guided walkthrough shown once a new account finishes onboarding.
 *
 * Built directly rather than with a tour library: react-joyride and its peers
 * do not yet declare React 19 support, and the behaviour needed here is a
 * spotlight plus a positioned card.
 *
 * Steps target existing UI through data-tour attributes. A step whose target is
 * missing on the current screen is skipped rather than left pointing at
 * nothing, so the tour degrades safely as the layout changes.
 */
const TOUR_STEPS = [
  {
    id: 'feed',
    target: '[data-tour="feed"]',
    title: 'Your feed',
    body: 'Posts from the communities you follow land here. Follow more schools and groups to fill it out.',
  },
  {
    id: 'navigation',
    target: '[data-tour="primary-nav"]',
    title: 'Getting around',
    body: 'Jump between your feed, communities, events, and saved items from here.',
  },
  {
    id: 'search',
    target: '[data-tour="search"]',
    title: 'Find anything',
    body: 'Search for universities, groups, people, and discussions from any page.',
  },
  {
    id: 'communities',
    target: '[data-tour="communities"]',
    title: 'Communities',
    body: 'Every school has a home on StudentSphere. Join yours to see its events and forums.',
  },
  {
    id: 'contact',
    target: '.contact-us-button',
    title: 'Need a hand?',
    body: 'Questions or feedback reach us straight from this button, wherever you are.',
    placement: 'top',
  },
];

const CARD_MARGIN = 14;
const VIEWPORT_PADDING = 12;

function ProductTour({ userData }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [steps, setSteps] = useState([]);
  const cardRef = useRef(null);
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 });

  const post = useCallback((payload) => {
    return axios
      .post(buildApiUrl('/api/tour_action.php'), payload, { withCredentials: true })
      .catch(() => {
        // The tour is cosmetic; a failed write only risks showing it again.
      });
  }, []);

  // Ask the server whether this user is due a tour.
  useEffect(() => {
    if (!userData?.user_id) {
      setActive(false);
      return undefined;
    }
    let cancelled = false;
    axios
      .get(buildApiUrl('/api/fetch_tour_state.php'), { withCredentials: true })
      .then((response) => {
        if (cancelled) return;
        const tour = response?.data?.tour;
        if (!tour?.eligible) return;

        const available = TOUR_STEPS.filter((step) => document.querySelector(step.target));
        if (available.length === 0) return;

        setSteps(available);
        setStepIndex(Math.min(Number(tour.current_step) || 0, available.length - 1));
        setActive(true);
        post({ action: 'start' });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userData?.user_id, post]);

  const currentStep = active ? steps[stepIndex] : null;

  // Track the spotlight target through scroll, resize, and step changes.
  useLayoutEffect(() => {
    if (!currentStep) return undefined;

    const measure = () => {
      const node = document.querySelector(currentStep.target);
      if (!node) {
        setRect(null);
        return;
      }
      const bounds = node.getBoundingClientRect();
      setRect({
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      });
    };

    measure();
    const node = document.querySelector(currentStep.target);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [currentStep]);

  // Keep the card beside the highlight and inside the viewport.
  useLayoutEffect(() => {
    if (!rect || !cardRef.current) return;
    const card = cardRef.current.getBoundingClientRect();
    const preferTop = currentStep?.placement === 'top';

    let top = preferTop
      ? rect.top - card.height - CARD_MARGIN
      : rect.top + rect.height + CARD_MARGIN;
    if (top + card.height > window.innerHeight - VIEWPORT_PADDING) {
      top = rect.top - card.height - CARD_MARGIN;
    }
    top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - card.height - VIEWPORT_PADDING));

    let left = rect.left + rect.width / 2 - card.width / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - card.width - VIEWPORT_PADDING));

    setCardPosition({ top, left });
  }, [rect, currentStep, stepIndex]);

  const finish = useCallback(
    (action) => {
      setActive(false);
      post({ action });
    },
    [post]
  );

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish('complete');
      return;
    }
    const target = stepIndex + 1;
    setStepIndex(target);
    post({ action: 'advance', current_step: target });
  }, [stepIndex, steps.length, finish, post]);

  const back = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  // Escape leaves the tour; arrows move through it.
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish('skip');
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, finish, next, back]);

  if (!active || !currentStep) {
    return null;
  }

  return (
    <div className="product-tour" role="dialog" aria-modal="true" aria-label="Product tour">
      <div
        className={`product-tour__scrim${rect ? '' : ' product-tour__scrim--solid'}`}
        onClick={() => finish('skip')}
      />
      {rect && (
        <div
          className="product-tour__spotlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div
        ref={cardRef}
        className="product-tour__card"
        style={{ top: cardPosition.top, left: cardPosition.left }}
      >
        <p className="product-tour__count">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <h3 className="product-tour__title">{currentStep.title}</h3>
        <p className="product-tour__body">{currentStep.body}</p>
        <div className="product-tour__actions">
          <button type="button" className="product-tour__skip" onClick={() => finish('skip')}>
            Skip tour
          </button>
          <div className="product-tour__nav">
            {stepIndex > 0 && (
              <button type="button" className="product-tour__back" onClick={back}>
                Back
              </button>
            )}
            <button type="button" className="product-tour__next" onClick={next}>
              {stepIndex >= steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductTour;
