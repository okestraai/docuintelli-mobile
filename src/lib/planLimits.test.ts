import { PLANS, yearlySavingLabel } from './planLimits';

describe('yearly prices', () => {
  it('are 20% off twelve months, rounded down to a whole dollar', () => {
    const paid = PLANS.filter((plan) => plan.price.monthly > 0);
    expect(paid.map((plan) => plan.id)).toEqual(['starter', 'pro', 'family']);
    for (const { price } of paid) {
      expect(price.yearly).toBe(Math.floor((price.monthly * 12 * 80) / 100));
    }
  });
});

describe('yearlySavingLabel', () => {
  it('shows 20% on the published prices', () => {
    expect(yearlySavingLabel(PLANS.map((plan) => plan.price))).toBe('Save 20%');
  });

  it('uses the smallest saving, so a plan still on its old price lowers it', () => {
    expect(yearlySavingLabel([{ monthly: 9, yearly: 90 }, { monthly: 19, yearly: 182 }])).toBe('Save 16%');
  });

  it('shows nothing when prices are missing or yearly is no cheaper', () => {
    expect(yearlySavingLabel([{ monthly: null, yearly: 85.99 }])).toBeNull();
    expect(yearlySavingLabel([{ monthly: 14.99, yearly: 181.99 }])).toBeNull();
    expect(yearlySavingLabel([{ monthly: 9, yearly: 86 }, undefined])).toBeNull();
    expect(yearlySavingLabel([{ monthly: 9.99, yearly: 95.99 }])).toBe('Save 19%');
  });
});
