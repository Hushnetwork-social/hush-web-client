import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from './Header';

describe('Header', () => {
  it('uses HushFeeds! exact default title', () => {
    render(<Header />);
    expect(screen.getByTestId('app-title')).toHaveTextContent('HushFeeds!');
  });

  it('renders active app title when provided', () => {
    render(<Header title="HushSocial!" />);
    expect(screen.getByTestId('app-title')).toHaveTextContent('HushSocial!');
  });

  it('renders the title as a button when a click handler is provided', () => {
    const onTitleClick = vi.fn();
    render(<Header title="HushSocial!" onTitleClick={onTitleClick} />);

    fireEvent.click(screen.getByTestId('app-title'));

    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });
});
