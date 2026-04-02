import { describe, expect, it } from 'vitest';
import tailwindConfig from '../tailwind.config';

describe('tailwind.config', () => {
  it('scans module-based source files for utility classes', () => {
    expect(tailwindConfig.content).toContain('./src/modules/**/*.{js,ts,jsx,tsx,mdx}');
  });
});
