import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders with success styles for "active" status', () => {
    render(<StatusBadge status="active" />);
    const badge = screen.getByText('active');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-status-success/10');
  });

  it('renders with warning styles for "suspended" status', () => {
    render(<StatusBadge status="suspended" />);
    const badge = screen.getByText('suspended');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-status-warning/10');
  });

  it('renders with accent styles for "scheduled" status', () => {
    render(<StatusBadge status="scheduled" />);
    const badge = screen.getByText('scheduled');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-accent/10');
  });

  it('renders with danger styles for "expired" status', () => {
    render(<StatusBadge status="expired" />);
    const badge = screen.getByText('expired');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-status-danger/10');
  });

  it('renders with default styles for unknown status', () => {
    render(<StatusBadge status="unknown" />);
    const badge = screen.getByText('unknown');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-bg-elevated');
  });

  it('renders correctly with mixed case status strings', () => {
    render(<StatusBadge status="ActIvE" />);
    const badge = screen.getByText('ActIvE');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-status-success/10');
  });
});
