import React from 'react';
import './LegalPage.css';

/**
 * Shared shell for the Privacy Policy and Terms of Service.
 *
 * The policy text itself is deliberately not written here: it is a legal
 * document that has to come from the operator (and ideally counsel), and
 * generated placeholder wording could be mistaken for a real policy. Replace
 * the `sections` passed in below with the approved copy.
 */
function LegalPage({ title, kicker, lastUpdated, sections = [] }) {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        {kicker && <p className="legal-page__kicker">{kicker}</p>}
        <h1 className="legal-page__title">{title}</h1>
        {lastUpdated && <p className="legal-page__meta">Last updated {lastUpdated}</p>}
      </header>

      {sections.length === 0 ? (
        <div className="legal-page__pending">
          <p>
            This document has not been published yet. Add the approved wording in{' '}
            <code>LegalPage</code> usage for this route before launch.
          </p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.heading} className="legal-page__section">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      sections={[]}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Service"
      sections={[]}
    />
  );
}

export default LegalPage;
