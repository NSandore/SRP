import React from 'react';
import { BadgeCheck, CircleMinus, ShieldCheck } from 'lucide-react';
import './VerificationComparison.css';

const rows = [
  {
    label: 'School connection',
    standard: 'Self-reported on your profile',
    verified: 'Reviewed and connected to a school',
  },
  {
    label: 'Profile trust signal',
    standard: 'No identity-verification badge',
    verified: 'Visible student or staff verification badge',
  },
  {
    label: 'Community participation',
    standard: 'Standard member features',
    verified: 'Standard member features plus a reviewed trust signal',
  },
  {
    label: 'Verified-member events',
    standard: 'Public and standard member events',
    verified: 'Can access events reserved for verified members of the associated community',
  },
  {
    label: 'Ambassador applications',
    standard: 'Not eligible through an unreviewed school affiliation',
    verified: 'Approved staff may apply at a university they follow; student verification alone does not qualify',
  },
  {
    label: 'Daily posting limit',
    standard: 'Raised by confirming your email—not by identity verification',
    verified: 'The same email-confirmation rule applies; identity review does not change the posting limit',
  },
  {
    label: 'Documents',
    standard: 'No documents required',
    verified: 'Used privately for review and never shown publicly',
  },
];

function VerificationComparison({ compact = false }) {
  return (
    <div className={`verification-comparison${compact ? ' verification-comparison--compact' : ''}`}>
      <table>
        <thead>
          <tr>
            <th scope="col">What changes</th>
            <th scope="col"><CircleMinus size={16} aria-hidden /> Not identity verified</th>
            <th scope="col"><BadgeCheck size={16} aria-hidden /> Identity verified</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.standard}</td>
              <td>{row.verified}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="verification-comparison__note">
        <ShieldCheck size={16} aria-hidden /> Identity verification is separate from email confirmation. It does not grant moderation or administrative permissions.
      </p>
    </div>
  );
}

export default VerificationComparison;
