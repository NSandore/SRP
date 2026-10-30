import React from 'react';
import { Link } from 'react-router-dom';
import './FaqPage.css';

const FAQ_GROUPS = [
  {
    title: 'Getting started',
    questions: [
      {
        question: 'What is StudentSphere?',
        answer: 'StudentSphere is a student community platform for finding campus groups, asking questions, sharing useful discussions, and connecting with people across university communities.',
      },
      {
        question: 'Why does a community look empty?',
        answer: 'StudentSphere is new, so some university and group spaces may not have discussions yet. Empty communities are open invitations: follow the community, ask its first question, or check back as ambassadors begin adding forums and events.',
      },
      {
        question: 'How do I join a community?',
        answer: 'Open the Communities directory, choose a university or group, and follow it. Following helps personalize your feed and keeps that community easy to find.',
      },
    ],
  },
  {
    title: 'Posting and participation',
    questions: [
      {
        question: 'What is the difference between a forum and a thread?',
        answer: 'A forum is a broad topic area inside a community. A thread is one focused conversation within a forum. Community ambassadors and administrators organize forums; eligible community contributors can begin threads.',
      },
      {
        question: 'How can I contribute to a new community?',
        answer: 'Start by following it and asking a useful question in Questions & Answers. If you are a community ambassador, you can also create the first discussion thread in an available forum and help curate pinned topics.',
      },
      {
        question: 'Why is my question pending review?',
        answer: 'Community questions are reviewed by ambassadors before they appear as verified community guidance. You can continue using StudentSphere while the question is pending.',
      },
      {
        question: 'Can I request a missing university or group?',
        answer: 'Yes. From the Communities page, signed-in members can submit a community request. Platform administrators review requests before publishing them.',
      },
    ],
  },
  {
    title: 'Accounts, trust, and safety',
    questions: [
      {
        question: 'Why should I verify my email or student status?',
        answer: 'Email verification helps protect the platform from spam and unlocks normal participation limits. Student or staff verification can support trusted campus roles and is reviewed separately.',
      },
      {
        question: 'Who can see my information?',
        answer: 'Your profile visibility and messaging preferences are managed in Account Settings. Sensitive verification documents are not public and are available only to you and authorized platform reviewers.',
      },
      {
        question: 'How do I report something?',
        answer: 'Use the report option on the relevant post, thread, forum, or community content. Reports go to authorized moderators or community reviewers; the person you report is not told who submitted it.',
      },
      {
        question: 'How do I secure my account?',
        answer: 'Use a unique password, enable two-factor authentication in Account Settings, and review active sessions regularly. You can revoke a session you no longer recognize.',
      },
    ],
  },
];

function FaqPage() {
  return (
    <main className="faq-page">
      <header className="faq-page__header">
        <p className="faq-page__kicker">Help center</p>
        <h1>Frequently asked questions</h1>
        <p>How communities, conversations, verification, and safety work on StudentSphere.</p>
      </header>

      <div className="faq-page__groups">
        {FAQ_GROUPS.map((group) => (
          <section className="faq-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="faq-group__questions">
              {group.questions.map((item) => (
                <details className="faq-item" key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="faq-page__support">
        <div>
          <h2>Still have a question?</h2>
          <p>
            Email <a href="mailto:support@thestudentsphere.com">support@thestudentsphere.com</a>, ask an ambassador inside the relevant community, or use the report option for specific content.
          </p>
        </div>
        <Link to="/communities">Browse communities</Link>
      </aside>
    </main>
  );
}

export default FaqPage;
