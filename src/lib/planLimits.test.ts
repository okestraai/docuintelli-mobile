import { PLANS } from './planLimits';

describe('yearly prices', () => {
  it('are 20% off twelve months, rounded down to a whole dollar', () => {
    const paid = PLANS.filter((plan) => plan.price.monthly > 0);
    expect(paid.map((plan) => plan.id)).toEqual(['starter', 'pro', 'family']);
    for (const { price } of paid) {
      expect(price.yearly).toBe(Math.floor((price.monthly * 12 * 80) / 100));
    }
  });
});
