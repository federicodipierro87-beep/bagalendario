import { eventStatusColor, eventStatusLabel, performanceStatusColor, performanceStatusLabel } from '../lib/labels';
import type { EventStatus, PerformanceStatus } from '../lib/types';

export function PerformanceStatusBadge({ stato }: { stato: PerformanceStatus }) {
  const c = performanceStatusColor[stato];
  return (
    <span className="status-badge" style={{ background: c.bg, color: c.fg }}>
      {performanceStatusLabel[stato]}
    </span>
  );
}

export function EventStatusBadge({ stato }: { stato: EventStatus }) {
  const c = eventStatusColor[stato];
  return (
    <span className="status-badge" style={{ background: c.bg, color: c.fg }}>
      {eventStatusLabel[stato]}
    </span>
  );
}
