/**
 * StockPulse AI API helpers — mobile client for CIRA v2 scoring engine.
 * Reuses all existing backend endpoints at /api/stockpulse/*
 */
import { auth } from './auth';
import { API_BASE } from './config';
import { getDeviceId } from './deviceId';

// ── Helpers ─────────────────────────────────────────────────────

async function backendHeaders(accessToken: string): Promise<Record<string, string>> {
  const deviceId = await getDeviceId();
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Device-ID': deviceId,
  };
}

async function getSession() {
  const { data: { session } } = await auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getSession();
  const headers = await backendHeaders(session.access_token);
  const res = await fetch(`${API_BASE}/api/stockpulse${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Types ───────────────────────────────────────────────────────

export interface CIRAScore {
  ticker: string;
  company_name: string;
  sector: string;
  current_price: number;
  raw_composite: number;
  cycle_adjusted: number;
  final_score: number;
  conviction: string;
  dimensions: DimensionScore[];
  gates: Gate[];
  intrinsic_value_estimate: number | null;
  margin_of_safety_pct: number | null;
  market_cycle_stage: string | null;
  llm_thesis?: string;
  llm_forecast?: { bull: string; base: string; bear: string };
  conviction_detail?: {
    confidence: number;
    reasoning: string;
    horizons: { horizon: string; label: string; verdict: string; score: number; confidence: number; keyDrivers: string[] }[];
    factors: { name: string; signal: string; weight: number; detail: string }[];
    override_applied: boolean;
    threshold_verdict: string;
  };
}

export interface DimensionScore {
  key: string;
  name: string;
  score: number;
  weight: number;
  weighted_score: number;
  reasoning: string;
  data_sources: string[];
  raw_data: Record<string, any>;
}

export interface Gate {
  name: string;
  triggered: boolean;
  value: string;
  effect: string;
}

export interface Recommendation {
  ticker: string;
  company_name: string;
  sector: string;
  current_price: number;
  /**
   * null when nobody has analyzed this stock yet.
   *
   * The dashboard now lists the whole browsable index (~1,000 stocks) rather than only the handful
   * that carry a CIRA score, and a full score is far too expensive to have for all of them — so
   * "not yet analyzed" is an ordinary state a card has to render, not a missing value to paper over.
   */
  current_score: number | null;
  current_conviction: string | null;
  intrinsic_value: number | null;
  margin_of_safety_pct: number | null;
  market_cycle_stage: string | null;
  gates_triggered: string[];
  created_at: string | null;
  /** 'deep' includes FMP enrichment and an LLM thesis; 'lite' is the same dimensions without them. */
  cira_tier?: 'deep' | 'lite' | null;
  change_pct?: number | null;
  market_cap?: number | null;
}

/** One row of the browsable index, as returned by GET /index. */
export interface IndexStock {
  ticker: string;
  name: string | null;
  sector: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  trailing_pe: number | null;
  cira_score: number | null;
  cira_tier: 'deep' | 'lite' | null;
  conviction: string | null;
  margin_of_safety_pct: number | null;
  scored_at: string | null;
  deep_scored_at: string | null;
  quote_at: string | null;
}

export interface IndexSnapshot {
  builtAt: string;
  count: number;
  stocks: IndexStock[];
}

export interface SimulatorPick {
  id: number;
  ticker: string;
  company_name: string;
  entry_price: number;
  current_price: number;
  shares: number;
  allocated_amount: number;
  ai_score_at_entry: number;
  ai_conviction_at_entry: string;
  current_ai_score: number | null;
  current_ai_conviction: string | null;
  pnl_dollars: number;
  pnl_percent: number;
  source: string;
  status: string;
  created_at: string;
  closed_at: string | null;
}

export interface SimulatorSummary {
  total_invested: number;
  current_value: number;
  total_pnl_dollars: number;
  total_pnl_percent: number;
  win_rate: number;
  winners: number;
  losers: number;
  best_pick: { ticker: string; pnl_percent: number } | null;
  worst_pick: { ticker: string; pnl_percent: number } | null;
  avg_ai_score: number;
  avg_hold_days: number;
  active_picks: number;
}

// ── Score APIs ──────────────────────────────────────────────────

/**
 * Fetch a ticker's CIRA analysis. Served from the stored result unless `refresh` is set — opening a
 * stock used to run a live 15-dimension score every single time, which cost seconds and burned the
 * shared daily data budget on work that had usually just been done.
 */
export async function scoreStock(ticker: string, opts: { refresh?: boolean } = {}): Promise<CIRAScore> {
  return fetchJSON<CIRAScore>(`/score/${ticker.toUpperCase()}${opts.refresh ? '?refresh=1' : ''}`);
}

export async function compareStocks(tickers: string[]): Promise<{ comparisons: CIRAScore[] }> {
  return fetchJSON(`/compare?tickers=${tickers.join(',')}`);
}

// ── Recommendations ─────────────────────────────────────────────

/**
 * Stocks that carry a CIRA score. Narrower than the index — use {@link getIndex} to browse.
 */
export async function getRecommendations(): Promise<{ count: number; recommendations: Recommendation[] }> {
  return fetchJSON('/recommendations');
}

// ── Index (the browsable universe) ──────────────────────────────

/**
 * The whole index in one call. The server returns a snapshot its cron prebuilt, so this is a cache
 * read rather than a query, and the payload is deliberately slim enough to send in one go.
 */
export async function getIndex(): Promise<IndexSnapshot> {
  return fetchJSON<IndexSnapshot>('/index');
}

/**
 * Look up a ticker or company. `results` come from the local index; `remote` are symbols Yahoo knows
 * that were not indexed yet — searching for one is what adds it.
 */
export async function searchStocks(q: string): Promise<{
  query: string;
  results: IndexStock[];
  remote: { ticker: string; name: string | null; exchange: string | null }[];
}> {
  return fetchJSON(`/index/search?q=${encodeURIComponent(q)}`);
}

/**
 * Tell the server a ticker was looked at, so the scarce deep-scoring budget follows real demand.
 * Fire-and-forget: it must never delay or fail the screen that triggered it.
 */
export async function recordInterest(ticker: string, kind: 'view' | 'search' = 'view'): Promise<void> {
  await fetchJSON('/index/interest', {
    method: 'POST',
    body: JSON.stringify({ ticker, kind }),
  }).catch(() => undefined);
}

/** Map an index row onto the shape the stock list renders. */
export function indexStockToRecommendation(s: IndexStock): Recommendation {
  return {
    ticker: s.ticker,
    company_name: s.name || s.ticker,
    sector: s.sector || 'Unknown',
    current_price: Number(s.price) || 0,
    current_score: s.cira_score == null ? null : Math.round(Number(s.cira_score)),
    current_conviction: s.conviction,
    intrinsic_value: null,
    margin_of_safety_pct: s.margin_of_safety_pct == null ? null : Number(s.margin_of_safety_pct),
    market_cycle_stage: null,
    gates_triggered: [],
    created_at: s.scored_at,
    cira_tier: s.cira_tier,
    change_pct: s.change_pct == null ? null : Number(s.change_pct),
    market_cap: s.market_cap == null ? null : Number(s.market_cap),
  };
}

export async function getRecommendationFeed(limit = 100): Promise<{ count: number; feed: any[] }> {
  return fetchJSON(`/recommendations/feed?limit=${limit}`);
}

export async function getConvictionChanges(limit = 50): Promise<{ count: number; changes: any[] }> {
  return fetchJSON(`/recommendations/changes?limit=${limit}`);
}

export async function getRecommendationDistribution(): Promise<{ distribution: any[] }> {
  return fetchJSON('/recommendations/distribution');
}

export async function getTickerHistory(ticker: string, limit = 50): Promise<{ ticker: string; count: number; history: any[] }> {
  return fetchJSON(`/recommendations/${ticker}?limit=${limit}`);
}

// ── Watchlist ───────────────────────────────────────────────────

export async function getWatchlist(): Promise<{ tickers: string[] }> {
  return fetchJSON('/watchlist');
}

export async function addToWatchlist(ticker: string): Promise<{ tickers: string[] }> {
  return fetchJSON('/watchlist/add', { method: 'POST', body: JSON.stringify({ ticker }) });
}

export async function removeFromWatchlist(ticker: string): Promise<{ tickers: string[] }> {
  return fetchJSON('/watchlist/remove', { method: 'POST', body: JSON.stringify({ ticker }) });
}

// ── Simulator ───────────────────────────────────────────────────

export async function getSimulator(): Promise<{ picks: SimulatorPick[]; summary: SimulatorSummary }> {
  return fetchJSON('/simulator');
}

export async function addSimulatorPick(ticker: string, source = 'manual'): Promise<any> {
  return fetchJSON('/simulator/add', { method: 'POST', body: JSON.stringify({ ticker, source }) });
}

export async function closeSimulatorPick(id: number): Promise<any> {
  return fetchJSON(`/simulator/close/${id}`, { method: 'POST' });
}

export async function refreshSimulator(): Promise<any> {
  return fetchJSON('/simulator/refresh', { method: 'POST' });
}

// ── Forecast ────────────────────────────────────────────────────

export async function getForecast(ticker: string, horizon = '6M'): Promise<any> {
  return fetchJSON(`/forecast/${ticker}?horizon=${horizon}`);
}

// ── Portfolio Construction ──────────────────────────────────────

export interface InvestorProfile {
  investmentAmount: number;
  horizon: 'short' | 'medium' | 'long' | 'very_long';
  riskTolerance: 'very_conservative' | 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  sectorPreferences: { overweight: string[]; exclude: string[]; esgOnly: boolean };
  incomeGrowthSplit: number;
  concentration: 'focused' | 'balanced' | 'diversified';
  existingHoldings: string[];
  constraints: {
    noPennyStocks: boolean;
    noOptions: boolean;
    nyseOnly: boolean;
    minMarketCap: number;
    dividendsOnly: boolean;
    maxPositionPct: number;
    maxSectorPct: number;
  };
}

export interface PortfolioPosition {
  ticker: string;
  companyName: string;
  sector: string;
  shares: number;
  entryPrice: number;
  allocatedAmount: number;
  weightPct: number;
  personalizedScore: number;
  recommendation: string;
  rationale: string;
}

export interface ConstructedPortfolio {
  name: string;
  totalInvested: number;
  remainingCash: number;
  portfolioScore: number;
  executiveSummary: string;
  keyRisks: string[];
  reviewCadence: string;
  positions: PortfolioPosition[];
  sectorAllocation: { sector: string; amount: number; pct: number }[];
  createdAt: string;
}

export async function constructPortfolio(profile: InvestorProfile): Promise<ConstructedPortfolio> {
  return fetchJSON('/portfolio/construct', { method: 'POST', body: JSON.stringify(profile) });
}

// ── Backtest ────────────────────────────────────────────────────

export interface BacktestRun {
  id: number;
  name: string;
  status: 'running' | 'completed' | 'failed';
  start_date: string;
  end_date: string;
  rebalance_freq: string;
  created_at: string;
  total_return_pct?: number;
  sharpe_ratio?: number;
  max_drawdown_pct?: number;
  benchmark_return_pct?: number;
}

export async function getBacktestRuns(): Promise<{ runs: BacktestRun[] }> {
  return fetchJSON('/backtest');
}

export async function getActiveBacktest(): Promise<{ active: BacktestRun | null }> {
  return fetchJSON('/backtest/active');
}

export async function getBacktestResult(id: number): Promise<any> {
  return fetchJSON(`/backtest/${id}`);
}

export async function startBacktest(config: {
  name: string;
  universe: string[];
  startDate: string;
  endDate: string;
  rebalanceFreq: string;
  benchmark: string;
}): Promise<any> {
  return fetchJSON('/backtest/run', { method: 'POST', body: JSON.stringify(config) });
}

// ── Closed Simulator Picks ──────────────────────────────────────

export async function getClosedPicks(): Promise<{ picks: SimulatorPick[] }> {
  return fetchJSON('/simulator/closed');
}

// ── Health ──────────────────────────────────────────────────────

export async function getHealth(): Promise<{ status: string }> {
  return fetchJSON('/health');
}
