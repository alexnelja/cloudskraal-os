import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LivestockHealth from './LivestockHealth';

describe('LivestockHealth', () => {
  it('renders health records table', () => {
    render(<LivestockHealth />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders Vaccination records', () => {
    render(<LivestockHealth />);
    const vaccinations = screen.getAllByText('Vaccination');
    expect(vaccinations.length).toBeGreaterThan(0);
  });

  it('renders Treatment records', () => {
    render(<LivestockHealth />);
    const treatments = screen.getAllByText('Treatment');
    expect(treatments.length).toBeGreaterThan(0);
  });

  it('renders Checkup records', () => {
    render(<LivestockHealth />);
    const checkups = screen.getAllByText('Checkup');
    expect(checkups.length).toBeGreaterThan(0);
  });

  it('renders all 8 mock health records', () => {
    render(<LivestockHealth />);
    // Each record has a description, check a known one
    expect(screen.getByText(/Pulpy kidney/)).toBeInTheDocument();
    expect(screen.getByText(/Internal parasite drench/)).toBeInTheDocument();
    expect(screen.getByText(/Ram fertility testing/)).toBeInTheDocument();
  });

  it('renders administered-by information', () => {
    render(<LivestockHealth />);
    expect(screen.getAllByText('Dr. van der Merwe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pieter (foreman)').length).toBeGreaterThan(0);
  });
});
