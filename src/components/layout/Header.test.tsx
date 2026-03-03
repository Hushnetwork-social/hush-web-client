import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
