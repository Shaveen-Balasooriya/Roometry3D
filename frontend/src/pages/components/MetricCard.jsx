import React from 'react';
import './MetricCard.css';

export default function MetricCard({ title, amount, icon }) {
  // Determine if card is in loading state
  const isLoading = amount === 'Loading...';
  
  return (
    <div className="metric-card" role="region" aria-label={`${title} metrics`}>
      <div className="metric-card-content">
        <div className="metric-icon" aria-hidden="true">
          {icon}
        </div>
        <div className="metric-info">
          <h3 className="metric-title">{title}</h3>
          <p className="metric-amount" aria-live="polite">
            <span className={isLoading ? 'loading' : ''}>
              {isLoading ? amount : typeof amount === 'number' ? amount.toLocaleString() : amount}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}