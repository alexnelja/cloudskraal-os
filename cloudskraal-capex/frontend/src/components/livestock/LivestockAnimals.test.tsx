import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LivestockAnimals from './LivestockAnimals';

describe('LivestockAnimals', () => {
  it('renders animal table with default mock data', () => {
    render(<LivestockAnimals groupName="default" />);
    expect(screen.getByText('DM-0001')).toBeInTheDocument();
    expect(screen.getByText('DM-0015')).toBeInTheDocument();
  });

  it('renders correct column headers', () => {
    render(<LivestockAnimals groupName="default" />);
    expect(screen.getByText('Tag')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('CS')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('filters animals by tag when searching', () => {
    render(<LivestockAnimals groupName="default" />);
    const searchInput = screen.getByPlaceholderText('Search by tag, breed, status...');
    fireEvent.change(searchInput, { target: { value: 'DM-0001' } });
    expect(screen.getByText('DM-0001')).toBeInTheDocument();
    expect(screen.queryByText('DM-0005')).not.toBeInTheDocument();
  });

  it('filters animals by status when searching', () => {
    render(<LivestockAnimals groupName="default" />);
    const searchInput = screen.getByPlaceholderText('Search by tag, breed, status...');
    fireEvent.change(searchInput, { target: { value: 'Cull' } });
    expect(screen.getByText('DM-0005')).toBeInTheDocument();
    expect(screen.getByText('DM-0012')).toBeInTheDocument();
    expect(screen.queryByText('DM-0001')).not.toBeInTheDocument();
  });

  it('shows empty message when no animals match search', () => {
    render(<LivestockAnimals groupName="default" />);
    const searchInput = screen.getByPlaceholderText('Search by tag, breed, status...');
    fireEvent.change(searchInput, { target: { value: 'ZZZZZ' } });
    expect(screen.getByText('No animals match your search.')).toBeInTheDocument();
  });

  it('shows count of filtered results', () => {
    render(<LivestockAnimals groupName="default" />);
    const searchInput = screen.getByPlaceholderText('Search by tag, breed, status...');
    fireEvent.change(searchInput, { target: { value: 'Cull' } });
    expect(screen.getByText(/Showing 2 of 15 animals/)).toBeInTheDocument();
  });
});
