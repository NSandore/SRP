import React from 'react';

type Webinar = {
  id: number;
  title: string;
  date: string; // ISO or readable
  host: string;
  href?: string;
};

const demoWebinars: Webinar[] = [
  { id: 1, title: 'Financial Aid 101', date: 'Sep 8, 4:00 PM', host: 'Counselor Team' },
  { id: 2, title: 'Crafting a Standout Personal Statement', date: 'Sep 12, 6:00 PM', host: 'Admissions Coach' },
];

export default function UpcomingWebinars() {
  return (
    <section className="widget-card" aria-labelledby="webinars-header">
      <div
        id="webinars-header"
        className="widget-header"
        style={{ backgroundColor: '#F43F5E' }}
      >
        <h3 className="widget-title">Upcoming Events</h3>
      </div>
      <div className="widget-body">
        <ul className="widget-list" aria-label="Upcoming webinars">
          {demoWebinars.map((w) => (
            <li key={w.id} className="widget-list-item">
              <div className="widget-item-title">{w.title}</div>
              <div className="widget-item-meta">{w.date} • {w.host}</div>
              <div className="widget-item-actions">
                <a href={w.href || '#'} className="widget-cta">Register</a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
