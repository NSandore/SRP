import React, { useMemo, useState } from 'react';

type Option = { id: number; label: string; votes: number };

const demoQuestion = 'What’s your biggest admissions concern right now?';
const demoOptions: Option[] = [
  { id: 1, label: 'Financial Aid', votes: 42 },
  { id: 2, label: 'Test Scores', votes: 27 },
  { id: 3, label: 'Essays', votes: 31 },
];

export default function PollOfTheDay() {
  const [options, setOptions] = useState<Option[]>(demoOptions);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);

  const totalVotes = useMemo(
    () => options.reduce((sum, o) => sum + o.votes, 0),
    [options]
  );

  const handleVote = (id: number) => {
    if (voted) return; // demo: single vote
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, votes: o.votes + 1 } : o)));
    setSelectedId(id);
    setVoted(true);
  };

  return (
    <section className="widget-card" aria-labelledby="poll-header">
      <div
        id="poll-header"
        className="widget-header"
        style={{ backgroundColor: '#F59E0B' }}
      >
        <h3 className="widget-title">Poll of the Day</h3>
      </div>
      <div className="widget-body">
        <div className="widget-poll-question">{demoQuestion}</div>
        <div className="widget-poll-options" role="group" aria-label="Poll options">
          {options.map((o) => {
            const percent = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
            const isSelected = selectedId === o.id;
            return (
              <div key={o.id} className="poll-option-row">
                <button
                  type="button"
                  className={`poll-option-button${isSelected ? ' selected' : ''}`}
                  onClick={() => handleVote(o.id)}
                  aria-pressed={isSelected}
                >
                  {o.label}
                </button>
                <span className="poll-option-meta">{voted ? `${percent}% • ${o.votes}` : ''}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

