import React from 'react';

type TrendingItem = {
  id: number;
  title: string;
  community: string;
  href?: string;
};

const demoTrending: TrendingItem[] = [
  { id: 1, title: 'How to maximize scholarship offers?', community: 'Financial Aid' },
  { id: 2, title: 'Best strategies for SAT in 6 weeks', community: 'Test Prep' },
  { id: 3, title: 'Campus housing pros/cons at State U', community: 'Student Life' },
];

export default function TrendingThreads() {
  return (
    <section className="widget-card" aria-labelledby="trending-header">
      <div
        id="trending-header"
        className="widget-header"
        style={{ backgroundColor: '#7C3AED' }}
      >
        <h3 className="widget-title">Trending Threads</h3>
      </div>
      <div className="widget-body">
        <ul className="widget-list" aria-label="Trending threads">
          {demoTrending.map((item) => (
            <li key={item.id} className="widget-list-item">
              <a href={item.href || '#'} className="widget-link">
                <div className="widget-item-title">{item.title}</div>
                <div className="widget-item-meta">in {item.community}</div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

