import React from 'react';
import './MetricCard.css';

export default function MetricCard({ title, amount, icon }) {
  return (
    <div className="metric-card">
      <div className="metric-card-content">
        <div className="metric-icon">
          {icon}
        </div>
        <div className="metric-info">
          <h3 className="metric-title">{title}</h3>
          <p className="metric-amount">{amount}</p>
        </div>
      </div>
    </div>
  );
}