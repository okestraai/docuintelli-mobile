import { scrollNeeded } from './KeyboardScrollView';

describe('scrollNeeded', () => {
  it('leaves an input alone when it already sits above the keyboard', () => {
    expect(scrollNeeded(900, 1500)).toBe(0);
  });

  it('scrolls an input the keyboard covers until it clears with a small gap', () => {
    expect(scrollNeeded(1850, 1500)).toBe(366);
  });
});
