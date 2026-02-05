import React, { useState } from 'react';
import './DonationPage.css';

const AMOUNT_PRESETS = [2, 5, 10, 25];

const TIERS = [
  {
    id: 'tip',
    name: 'Community tip',
    amount: 'Any amount',
    perks: ['Keeps the project running', 'No extra features'],
  },
  {
    id: 'supporter',
    name: 'Supporter',
    amount: '$5+',
    perks: ['Unlocks supporter-only features', 'Supporter badge', 'Early access to new tools'],
  },
  {
    id: 'future-1',
    name: 'Future tier',
    amount: 'TBD',
    perks: ['More features coming soon'],
    comingSoon: true,
  },
  {
    id: 'future-2',
    name: 'Future tier',
    amount: 'TBD',
    perks: ['Details announced later'],
    comingSoon: true,
  },
];

export default function DonationPage() {
  const [amountInput, setAmountInput] = useState('5');
  const parsedAmount = Number(amountInput);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const qualifiesForSupporter = isValidAmount && parsedAmount >= 5;
  const selectedTierId = isValidAmount ? (qualifiesForSupporter ? 'supporter' : 'tip') : null;
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
            Donations keep the community free, fund new tooling, and help us ship faster. You can
            chip in any amount. Supporter perks unlock at $5.
          </p>
          <div className="donation-callouts">
            <div className="donation-callout">
              <h3 className="donation-callout-title">Every dollar helps</h3>
              <p className="donation-callout-text">Small tips cover hosting and moderation support.</p>
            </div>
            <div className="donation-callout">
              <h3 className="donation-callout-title">Supporters get more</h3>
              <p className="donation-callout-text">Donate $5+ to unlock extra features as they roll out.</p>
            </div>
          </div>
        </div>

        <div className="donation-card">
          <div className="donation-card-header">
            <h2 className="donation-card-title">Choose your amount</h2>
            <p className="donation-card-subtitle">Supporter perks start at $5, but any amount is welcome.</p>
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
            <span className={`donation-tier-chip ${qualifiesForSupporter ? 'supporter' : 'tip'}`}>
              {qualifiesForSupporter ? 'Supporter perks' : 'Community tip'}
            </span>
          </div>

          <button className="primary-button donation-cta" type="button" disabled={!isValidAmount}>
            Continue to donate
          </button>
          <p className="donation-fineprint">Donation checkout integration is coming soon.</p>
        </div>
      </section>

      <section className="donation-table-card">
        <div className="donation-table-header">
          <h2>Donation tiers</h2>
          <p className="donation-table-subtitle">
            Select any amount. Supporter perks begin at $5. More tiers are on the way.
          </p>
        </div>
        <div className="donation-table-wrapper">
          <table className="donation-table">
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Amount</th>
                <th scope="col">Features</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((tier) => {
                const isSelected = selectedTierId && tier.id === selectedTierId;
                return (
                  <tr
                    key={tier.id}
                    className={`donation-tier-row ${isSelected ? 'selected' : ''} ${tier.comingSoon ? 'coming-soon' : ''}`}
                  >
                    <th scope="row">
                      <div className="donation-tier-title">
                        <span>{tier.name}</span>
                        {tier.comingSoon && <span className="donation-tag">Coming soon</span>}
                      </div>
                    </th>
                    <td>{tier.amount}</td>
                    <td>
                      <ul className="donation-perks">
                        {tier.perks.map((perk) => (
                          <li key={perk}>{perk}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="donation-note">Donate $5+ to unlock additional features. Any amount helps.</p>
      </section>
    </div>
  );
}
