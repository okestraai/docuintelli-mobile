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
  current_score: number;
  current_conviction: string;
  intrinsic_value: number | null;
  margin_of_safety_pct: number | null;
  market_cycle_stage: string | null;
  gates_triggered: string[];
  created_at: string;
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

export async function scoreStock(ticker: string): Promise<CIRAScore> {
  return fetchJSON<CIRAScore>(`/score/${ticker.toUpperCase()}`);
}

export async function compareStocks(tickers: string[]): Promise<{ comparisons: CIRAScore[] }> {
  return fetchJSON(`/compare?tickers=${tickers.join(',')}`);
}

// ── Recommendations ─────────────────────────────────────────────

export async function getRecommendations(): Promise<{ count: number; recommendations: Recommendation[] }> {
  return fetchJSON('/recommendations');
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
