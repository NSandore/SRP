import React, { useState } from 'react';
import './DonationPage.css';

const AMOUNT_PRESETS = [2, 5, 10, 25];

const SUPPORT_AREAS = [
  {
    id: 'hosting',
    name: 'Reliable access',
    purpose: 'Hosting and core infrastructure',
    commitment: 'The platform remains free for everyone',
  },
  {
    id: 'moderation',
    name: 'A thoughtful commons',
    purpose: 'Safety and moderation tooling',
    commitment: 'No paid visibility or posting privileges',
  },
  {
    id: 'tools',
    name: 'Useful tools',
    purpose: 'Community and research features',
    commitment: 'No supporter-only feature tier',
  },
];

export default function DonationPage() {
  const [amountInput, setAmountInput] = useState('5');
  const parsedAmount = Number(amountInput);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const activePreset = AMOUNT_PRESETS.includes(parsedAmount) ? parsedAmount : null;
  const displayAmount = isValidAmount ? amountInput : '--';

  const handleAmountChange = (event) => {
    setAmountInput(event.target.value);
  };

  return (
    <div className="donation-page">
      <section className="donation-hero">
        <div className="donation-intro">
          <p className="donation-kicker">Support the project</p>
          <h1 className="donation-title">Help SRP keep building for students</h1>
          <p className="donation-lede">
            Future voluntary contributions will help cover hosting, moderation, and useful
            community tooling. StudentSphere remains a free-first platform with no paid feature tiers.
          </p>
          <div className="donation-callouts">
            <div className="donation-callout">
              <h3 className="donation-callout-title">Every dollar helps</h3>
              <p className="donation-callout-text">Small tips cover hosting and moderation support.</p>
            </div>
            <div className="donation-callout">
              <h3 className="donation-callout-title">Access stays equal</h3>
              <p className="donation-callout-text">Contributions will never buy reach, status, or extra platform privileges.</p>
            </div>
          </div>
        </div>

        <div className="donation-card">
          <div className="donation-card-header">
            <h2 className="donation-card-title">Choose your amount</h2>
            <p className="donation-card-subtitle">Preview a voluntary contribution. Checkout is not live yet.</p>
          </div>

          <div className="donation-amount-options">
            {AMOUNT_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                className={`donation-amount-button ${activePreset === value ? 'active' : ''}`}
                onClick={() => setAmountInput(String(value))}
              >
                ${value}
              </button>
            ))}
          </div>

          <div className="donation-input-row">
            <label className="donation-input-label" htmlFor="donation-amount">
              Custom amount
            </label>
            <div className="donation-input-wrap">
              <span className="donation-currency">$</span>
              <input
                id="donation-amount"
                type="number"
                min="1"
                step="1"
                value={amountInput}
                onChange={handleAmountChange}
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div className="donation-summary" aria-live="polite">
            <div>
              <p className="donation-summary-label">Selected amount</p>
              <p className="donation-summary-value">${displayAmount}</p>
            </div>
            <span className="donation-tier-chip tip">
              No paid tier
            </span>
          </div>

          <button className="primary-button donation-cta" type="button" disabled>
            Donation checkout coming soon
          </button>
          <p className="donation-fineprint">No payment information is collected on this page.</p>
        </div>
      </section>

      <section className="donation-table-card">
        <div className="donation-table-header">
          <h2>Where support will go</h2>
          <p className="donation-table-subtitle">
            Voluntary support will fund shared infrastructure without changing anyone’s access.
          </p>
        </div>
        <div className="donation-table-wrapper">
          <table className="donation-table">
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Purpose</th>
                <th scope="col">Commitment</th>
              </tr>
            </thead>
            <tbody>
              {SUPPORT_AREAS.map((area) => (
                <tr key={area.id} className="donation-tier-row">
                  <th scope="row">{area.name}</th>
                  <td>{area.purpose}</td>
                  <td>{area.commitment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="donation-note">StudentSphere is free-first: no subscriptions or paid feature tiers are offered.</p>
      </section>
    </div>
  );
}
