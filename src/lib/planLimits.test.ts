import { tokensLeftText, PLANS, PLAN_LIMITS, applyPlanLimits, devicesText, tokensText, yearlySavingLabel } from './planLimits';

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

describe('live plan limits', () => {
  it('format tokens and devices as the cards state them', () => {
    expect(tokensText(600_000)).toBe('600K');
    expect(tokensText(3_000_000)).toBe('3M');
    expect(tokensText(1_500_000)).toBe('1.5M');
    expect(devicesText(1)).toBe('1 device');
    expect(devicesText(3)).toBe('Up to 3 devices');
  });

  it('take the numbers an admin has set', () => {
    const before = JSON.parse(JSON.stringify(PLAN_LIMITS));
    applyPlanLimits({ ...before, pro: { documents: 75, monthlyUploads: 20, devices: 4, aiTokens: 1_000_000 } });
    expect(PLAN_LIMITS.pro.documents).toBe(75);
    applyPlanLimits(before);
    expect(PLAN_LIMITS.pro.documents).toBe(50);
  });
});

describe('tokensLeftText', () => {
  it('keeps the balance on one short line', () => {
    expect(tokensLeftText(50000)).toBe('50K');
    expect(tokensLeftText(3000000)).toBe('3M');
    expect(tokensLeftText(999)).toBe('999');
    expect(tokensLeftText(0)).toBe('0');
  });
});
