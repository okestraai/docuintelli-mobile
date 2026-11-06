import { HELP_TOPICS } from '../content/helpTopics';
import { formatStorage, freePlanFeatures, isStorageBased, withFreePlanAnswers, type FreePlanFacts } from './freePlan';

jest.mock('./api', () => ({ getSubscriptionStorage: jest.fn() }));
jest.mock('./config', () => ({ API_BASE: '' }));

const OFF: FreePlanFacts = { storageBased: false, storageLimitMB: 10, aiQuestions: 10, esignPerMonth: 0, esignSigners: 0 };
const ON: FreePlanFacts = { ...OFF, storageBased: true, esignPerMonth: 1, esignSigners: 1 };
const CARD = ['5 documents', '5 uploads/month', '50K AI tokens/month', '1 device'];

describe('freePlanFeatures', () => {
  it('leaves the card alone with the switch off', () => {
    expect(freePlanFeatures(CARD, OFF).filter((f) => !f.includes('AI questions'))).toEqual(CARD);
  });

  it('describes storage, e-signature and the audit with the switch on', () => {
    expect(freePlanFeatures(CARD, ON)).toEqual(['10 MB of storage', '50K AI tokens/month', '10 AI questions/month', '1 device', 'E-Signatures (1/mo, 1 signer)', 'Weekly Audit']);
  });

  it('shows the AI question limit from the setting', () => {
    expect(freePlanFeatures(CARD, { ...OFF, aiQuestions: 25 })).toContain('25 AI questions/month');
    expect(freePlanFeatures(CARD, { ...ON, aiQuestions: 25 })).toContain('25 AI questions/month');
  });

  it('leaves e-signature out at 0', () => {
    expect(freePlanFeatures(CARD, { ...ON, esignPerMonth: 0 }).join(' ')).not.toContain('E-Signatures');
  });
});

describe('withFreePlanAnswers', () => {
  const answerTo = (facts: FreePlanFacts, question: string) =>
    withFreePlanAnswers(HELP_TOPICS, facts).flatMap((t) => t.questions).find((q) => q.question === question)?.answer;

  it('returns the real topics untouched with the switch off', () => {
    expect(withFreePlanAnswers(HELP_TOPICS, OFF)).toBe(HELP_TOPICS);
  });

  it('rewrites the real questions with the switch on', () => {
    expect(answerTo(ON, 'What happens if I downgrade?')).toContain('keeps all your documents');
    expect(answerTo(ON, 'What counts toward my upload limit?')).toContain('10 MB of storage');
  });
});

describe('isStorageBased', () => {
  it.each([
    [{ plan: 'free', document_limit: 99999 }, true],
    [{ plan: 'free', document_limit: 5 }, false],
    [{ plan: 'pro', document_limit: 99999 }, false],
    [null, false],
  ])('%j is %s', (subscription, expected) => {
    expect(isStorageBased(subscription)).toBe(expected);
  });
});

describe('formatStorage', () => {
  it('shows one decimal place', () => {
    expect(formatStorage(1572864)).toBe('1.5 MB');
  });
});
