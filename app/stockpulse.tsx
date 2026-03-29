import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  TextInput, Alert, Modal, Switch, FlatList, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Line, Text as SvgText, Rect } from 'react-native-svg';
import {
  BarChart3, TrendingUp, TrendingDown, Search, SlidersHorizontal, X,
  Target, RefreshCw, Sparkles, AlertTriangle,
  Eye, Briefcase, FlaskConical, Play, ChevronRight,
  DollarSign, Percent, ArrowRight, Clock, Check,
  ChevronDown, ChevronUp, Bell, Plus, Shield, Leaf,
  Cpu, Heart, Zap, Building2, ShoppingBag, Factory,
  Gem, Lightbulb, Home, Radio, Settings, LayoutGrid,
} from 'lucide-react-native';
import { useSubscription } from '../src/hooks/useSubscription';
import { useToast } from '../src/contexts/ToastContext';
import Card from '../src/components/ui/Card';
import Badge from '../src/components/ui/Badge';
import Button from '../src/components/ui/Button';
import GradientIcon from '../src/components/ui/GradientIcon';
import LoadingSpinner from '../src/components/ui/LoadingSpinner';
import ProFeatureGate from '../src/components/ProFeatureGate';
import StockCard from '../src/components/stockpulse/StockCard';
import SimulatorCard from '../src/components/stockpulse/SimulatorCard';
import ScoreRing from '../src/components/stockpulse/ScoreRing';
import ConvictionBadge from '../src/components/stockpulse/ConvictionBadge';
import {
  getRecommendations, scoreStock, getSimulator, addSimulatorPick,
  closeSimulatorPick, refreshSimulator, constructPortfolio, getBacktestRuns, getActiveBacktest,
  getBacktestResult, startBacktest, getClosedPicks, getTickerHistory,
  getForecast, getConvictionChanges,
  type Recommendation, type CIRAScore, type SimulatorPick, type SimulatorSummary,
  type InvestorProfile, type ConstructedPortfolio, type PortfolioPosition,
  type BacktestRun,
} from '../src/lib/stockpulseApi';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';

// ═══════════════════════════════════════════════════════════════════
// TAB DEFINITIONS — mirrors web StockPulseApp.tsx exactly
// ═══════════════════════════════════════════════════════════════════

type TabId = 'dashboard' | 'invest' | 'portfolio' | 'simulator' | 'backtest';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Screener', icon: BarChart3 },
  { id: 'invest', label: 'Invest', icon: Sparkles },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'simulator', label: 'Simulator', icon: Target },
  { id: 'backtest', label: 'Backtest', icon: FlaskConical },
];

type SortOption = 'score_high' | 'score_low' | 'price_high' | 'price_low' | 'alpha' | 'market_cap' | 'mos_high';
type ConvictionFilter = 'ALL' | 'Strong Buy' | 'Buy' | 'Hold' | 'Reduce' | 'Sell';
type MosFilter = 'all' | 'undervalued' | 'overvalued';
type GateFilter = 'all' | 'no_gates' | 'gates_active';
type CompanyTab = 'scores' | 'gates' | 'forecast' | 'events' | 'history';
type PortfolioSubTab = 'holdings' | 'recommendations' | 'alerts';

// Sector list matching web
const SECTORS_LIST = [
  'Technology', 'Healthcare', 'Financials', 'Energy',
  'Consumer Discretionary', 'Consumer Staples', 'Industrials',
  'Materials', 'Real Estate', 'Utilities', 'Communication Services',
];

const SECTOR_ICONS: Record<string, any> = {
  Technology: Cpu, Healthcare: Heart, Financials: Building2, Energy: Zap,
  'Consumer Discretionary': ShoppingBag, 'Consumer Staples': ShoppingBag,
  Industrials: Factory, Materials: Gem, 'Real Estate': Home,
  Utilities: Lightbulb, 'Communication Services': Radio,
};

// ═══════════════════════════════════════════════════════════════════
// MAIN SCREEN — Pro-gated
// ═══════════════════════════════════════════════════════════════════

export default function StockPulseScreen() {
  const { isPro, loading: subLoading } = useSubscription();

  if (!subLoading && !isPro) {
    return (
      <ProFeatureGate
        featureName="StockPulse AI"
        featureDescription="AI-powered stock research with CIRA v2 scoring, portfolio construction, paper trading simulator, backtesting, and real-time recommendations."
        onUpgrade={() => router.push('/billing')}
        requiredPlan="pro"
      />
    );
  }

  if (subLoading) return <LoadingSpinner fullScreen />;

  return <StockPulseContent />;
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT
// ═══════════════════════════════════════════════════════════════════

function StockPulseContent() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // ── Dashboard state ──
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('score_high');
  const [convictionFilter, setConvictionFilter] = useState<ConvictionFilter>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [mosFilter, setMosFilter] = useState<MosFilter>('all');
  const [gateFilter, setGateFilter] = useState<GateFilter>('all');

  // ── Invest For Me state ──
  const [investStep, setInvestStep] = useState(0);
  const [investProfile, setInvestProfile] = useState<InvestorProfile>({
    investmentAmount: 10000,
    horizon: 'medium',
    riskTolerance: 'moderate',
    sectorPreferences: { overweight: [], exclude: [], esgOnly: false },
    incomeGrowthSplit: 50,
    concentration: 'balanced',
    existingHoldings: [],
    constraints: {
      noPennyStocks: true, noOptions: true, nyseOnly: false,
      minMarketCap: 0, dividendsOnly: false, maxPositionPct: 15, maxSectorPct: 30,
    },
  });
  const [constructing, setConstructing] = useState(false);
  const [constructedPortfolio, setConstructedPortfolio] = useState<ConstructedPortfolio | null>(null);
  const [investError, setInvestError] = useState<string | null>(null);

  // ── Portfolio state ──
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioPicks, setPortfolioPicks] = useState<SimulatorPick[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<SimulatorSummary | null>(null);
  const [portfolioSubTab, setPortfolioSubTab] = useState<PortfolioSubTab>('holdings');
  const [portfolioAlerts, setPortfolioAlerts] = useState<any[]>([]);
  const [portfolioRecs, setPortfolioRecs] = useState<any[]>([]);
  const [portfolioLiveScores, setPortfolioLiveScores] = useState<Record<string, { score: number; price: number; conviction: string }>>({});
  const [recHorizon, setRecHorizon] = useState<'short' | 'medium' | 'long'>('medium');
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [addStockForm, setAddStockForm] = useState({ ticker: '', shares: '', price: '', date: '', notes: '' });

  // ── Simulator state ──
  const [simPicks, setSimPicks] = useState<SimulatorPick[]>([]);
  const [simSummary, setSimSummary] = useState<SimulatorSummary | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [simRefreshing, setSimRefreshing] = useState(false);
  const [addTickerInput, setAddTickerInput] = useState('');
  const [addingPick, setAddingPick] = useState(false);
  const [expandedSimTicker, setExpandedSimTicker] = useState<string | null>(null);

  // ── Backtest state ──
  const [btRuns, setBtRuns] = useState<BacktestRun[]>([]);
  const [btLoading, setBtLoading] = useState(false);
  const [btActive, setBtActive] = useState<BacktestRun | null>(null);
  const [btStarting, setBtStarting] = useState(false);
  const [btResult, setBtResult] = useState<any>(null);
  const btPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [btName, setBtName] = useState('CIRA v2 Quarterly Backtest');
  const [btStartDate, setBtStartDate] = useState('2023-01-01');
  const [btEndDate, setBtEndDate] = useState('2025-12-31');
  const [btFreq, setBtFreq] = useState<'quarterly' | 'monthly'>('quarterly');

  // ── Company detail modal ──
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CIRAScore | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  // ────────────────────────────────────────────────────────────────
  // DATA LOADERS
  // ────────────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    try {
      const { recommendations: recs } = await getRecommendations();
      setRecommendations(recs || []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load stocks', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadSimulator = useCallback(async () => {
    try {
      setSimLoading(true);
      const data = await getSimulator();
      setSimPicks(data.picks || []);
      setSimSummary(data.summary || null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load simulator', 'error');
    } finally {
      setSimLoading(false);
    }
  }, []);

  const loadPortfolio = useCallback(async () => {
    try {
      setPortfolioLoading(true);
      const data = await getSimulator();
      setPortfolioPicks(data.picks || []);
      setPortfolioSummary(data.summary || null);

      // Score holdings for live alerts
      const activePicks = (data.picks || []).filter((p: SimulatorPick) => p.status === 'active');
      const liveScoresMap: typeof portfolioLiveScores = {};
      for (const pick of activePicks.slice(0, 10)) {
        try {
          const result = await scoreStock(pick.ticker);
          liveScoresMap[pick.ticker] = { score: result.final_score, price: result.current_price, conviction: result.conviction };
        } catch { /* skip */ }
      }
      setPortfolioLiveScores(liveScoresMap);

      // Generate alerts from live scores
      const alerts: any[] = [];
      let id = 1;
      for (const pick of activePicks) {
        const live = liveScoresMap[pick.ticker];
        if (!live) continue;
        const gainPct = pick.entry_price > 0 ? ((live.price - pick.entry_price) / pick.entry_price) * 100 : 0;
        if (live.score < 40) {
          alerts.push({ id: String(id++), ticker: pick.ticker, companyName: pick.company_name, priority: 'high', title: `CIRA Score Critical: ${Math.round(live.score)}`, message: `${pick.ticker} score is ${Math.round(live.score)} (${live.conviction}). Consider reducing.`, action: 'consider_selling' });
        } else if (live.conviction === 'Reduce' || live.conviction === 'Sell') {
          alerts.push({ id: String(id++), ticker: pick.ticker, companyName: pick.company_name, priority: 'high', title: `Conviction: ${live.conviction}`, message: `Review your ${pick.ticker} position.`, action: 'review' });
        }
        if (gainPct > 30) {
          alerts.push({ id: String(id++), ticker: pick.ticker, companyName: pick.company_name, priority: 'medium', title: `Up ${gainPct.toFixed(0)}% — Consider Profit`, message: `${pick.ticker} is up ${gainPct.toFixed(1)}%.`, action: 'consider_selling' });
        }
        if (gainPct < -15) {
          alerts.push({ id: String(id++), ticker: pick.ticker, companyName: pick.company_name, priority: 'medium', title: `Down ${Math.abs(gainPct).toFixed(0)}%`, message: `${pick.ticker} is down ${Math.abs(gainPct).toFixed(1)}%. Score: ${Math.round(live.score)}.`, action: 'review' });
        }
      }
      setPortfolioAlerts(alerts);

      // Load recs for portfolio tab
      try {
        const { recommendations: allRecs } = await getRecommendations();
        const holdingTickers = new Set(activePicks.map((p: SimulatorPick) => p.ticker));
        const filtered = (allRecs || []).filter((r: Recommendation) =>
          holdingTickers.has(r.ticker) || r.current_conviction === 'Strong Buy'
        ).sort((a: Recommendation, b: Recommendation) => (b.current_score || 0) - (a.current_score || 0)).slice(0, 20);
        setPortfolioRecs(filtered);
      } catch { /* skip */ }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load portfolio', 'error');
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  const loadBacktests = useCallback(async () => {
    try {
      setBtLoading(true);
      const [runsData, activeData] = await Promise.all([
        getBacktestRuns(),
        getActiveBacktest(),
      ]);
      setBtRuns(runsData.runs || []);
      setBtActive(activeData.active || null);

      const completed = (runsData.runs || []).find((r: BacktestRun) => r.status === 'completed');
      if (completed) {
        const result = await getBacktestResult(completed.id);
        setBtResult(result);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load backtests', 'error');
    } finally {
      setBtLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, []);

  useEffect(() => {
    if (activeTab === 'simulator' && simPicks.length === 0 && !simLoading) loadSimulator();
    if (activeTab === 'portfolio' && portfolioPicks.length === 0 && !portfolioLoading) loadPortfolio();
    if (activeTab === 'backtest' && btRuns.length === 0 && !btLoading) loadBacktests();
  }, [activeTab]);

  // Poll for active backtest
  useEffect(() => {
    if (btActive && btActive.status === 'running') {
      btPollRef.current = setInterval(async () => {
        try {
          const { active } = await getActiveBacktest();
          setBtActive(active);
          if (!active || active.status !== 'running') {
            if (btPollRef.current) clearInterval(btPollRef.current);
            await loadBacktests();
          }
        } catch { /* ignore */ }
      }, 5000);
      return () => { if (btPollRef.current) clearInterval(btPollRef.current); };
    }
  }, [btActive?.status]);

  // ────────────────────────────────────────────────────────────────
  // COMPANY DETAIL
  // ────────────────────────────────────────────────────────────────

  const openCompany = async (ticker: string) => {
    setSelectedTicker(ticker);
    setCompanyLoading(true);
    setCompanyData(null);
    try {
      const data = await scoreStock(ticker);
      setCompanyData(data);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load stock', 'error');
      setSelectedTicker(null);
    } finally {
      setCompanyLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // SIMULATOR ACTIONS
  // ────────────────────────────────────────────────────────────────

  const handleAddPick = async () => {
    const ticker = addTickerInput.trim().toUpperCase();
    if (!ticker) return;
    setAddingPick(true);
    try {
      await addSimulatorPick(ticker);
      setAddTickerInput('');
      showToast(`Added ${ticker} to simulator`, 'success');
      await loadSimulator();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add pick', 'error');
    } finally {
      setAddingPick(false);
    }
  };

  const handleClosePick = (pick: SimulatorPick) => {
    Alert.alert('Close Pick', `Close ${pick.ticker} position and lock in P&L?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive', onPress: async () => {
          setClosingId(pick.id);
          try {
            await closeSimulatorPick(pick.id);
            showToast(`Closed ${pick.ticker}`, 'success');
            await loadSimulator();
          } catch (err: any) {
            showToast(err?.message || 'Failed to close pick', 'error');
          } finally {
            setClosingId(null);
          }
        },
      },
    ]);
  };

  const handleRefreshPrices = async () => {
    setSimRefreshing(true);
    try {
      await refreshSimulator();
      await loadSimulator();
      showToast('Prices refreshed', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to refresh', 'error');
    } finally {
      setSimRefreshing(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // INVEST FOR ME
  // ────────────────────────────────────────────────────────────────

  const handleConstructPortfolio = async () => {
    setConstructing(true);
    setInvestError(null);
    try {
      const result = await constructPortfolio(investProfile);
      setConstructedPortfolio(result);
      setInvestStep(99); // Show results
    } catch (err: any) {
      setInvestError(err?.message || 'Failed to construct portfolio');
    } finally {
      setConstructing(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // BACKTEST
  // ────────────────────────────────────────────────────────────────

  const DEFAULT_UNIVERSE = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'JPM', 'JNJ', 'V', 'XOM', 'HD', 'PG', 'UNH', 'BAC', 'CRM'];

  const handleStartBacktest = async () => {
    setBtStarting(true);
    try {
      await startBacktest({
        name: btName,
        universe: DEFAULT_UNIVERSE,
        startDate: btStartDate,
        endDate: btEndDate,
        rebalanceFreq: btFreq,
        benchmark: 'SPY',
      });
      showToast('Backtest started', 'success');
      const { active } = await getActiveBacktest();
      setBtActive(active);
    } catch (err: any) {
      showToast(err?.message || 'Failed to start backtest', 'error');
    } finally {
      setBtStarting(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────
  // FILTER + SORT (DASHBOARD)
  // ────────────────────────────────────────────────────────────────

  const sectors = useMemo(() => {
    const recSectors = [...new Set(recommendations.map(r => r.sector).filter(Boolean))];
    return ['ALL', ...recSectors.sort()];
  }, [recommendations]);

  const filteredCompanies = useMemo(() => {
    let result = [...recommendations];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.ticker.toLowerCase().includes(q) || r.company_name?.toLowerCase().includes(q));
    }
    if (sectorFilter !== 'ALL') result = result.filter(r => r.sector === sectorFilter);
    if (convictionFilter !== 'ALL') result = result.filter(r => r.current_conviction === convictionFilter);
    result = result.filter(r => {
      const score = Math.round(Number(r.current_score) || 0);
      return score >= scoreMin && score <= scoreMax;
    });
    if (mosFilter === 'undervalued') result = result.filter(r => r.margin_of_safety_pct != null && Number(r.margin_of_safety_pct) > 0);
    else if (mosFilter === 'overvalued') result = result.filter(r => r.margin_of_safety_pct != null && Number(r.margin_of_safety_pct) < 0);
    if (gateFilter === 'no_gates') result = result.filter(r => !r.gates_triggered || r.gates_triggered.length === 0);
    else if (gateFilter === 'gates_active') result = result.filter(r => r.gates_triggered && r.gates_triggered.length > 0);

    switch (sortBy) {
      case 'score_high': result.sort((a, b) => (b.current_score || 0) - (a.current_score || 0)); break;
      case 'score_low': result.sort((a, b) => (a.current_score || 0) - (b.current_score || 0)); break;
      case 'price_high': result.sort((a, b) => (b.current_price || 0) - (a.current_price || 0)); break;
      case 'price_low': result.sort((a, b) => (a.current_price || 0) - (b.current_price || 0)); break;
      case 'alpha': result.sort((a, b) => a.ticker.localeCompare(b.ticker)); break;
      case 'mos_high': result.sort((a, b) => (Number(b.margin_of_safety_pct) || -999) - (Number(a.margin_of_safety_pct) || -999)); break;
      case 'market_cap': result.sort((a, b) => (b.current_price || 0) - (a.current_price || 0)); break;
    }
    return result;
  }, [recommendations, searchQuery, sectorFilter, convictionFilter, scoreMin, scoreMax, sortBy, mosFilter, gateFilter]);

  const convictionCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Strong Buy': 0, 'Buy': 0, 'Hold': 0, 'Reduce': 0, 'Sell': 0 };
    recommendations.forEach(r => { if (counts[r.current_conviction] !== undefined) counts[r.current_conviction]++; });
    return counts;
  }, [recommendations]);

  const dashStats = useMemo(() => {
    if (filteredCompanies.length === 0) return { total: 0, avgScore: 0, topPick: null as Recommendation | null };
    const avgScore = filteredCompanies.reduce((s, c) => s + (Number(c.current_score) || 0), 0) / filteredCompanies.length;
    const topPick = filteredCompanies.reduce((best, c) => (Number(c.current_score) || 0) > (Number(best.current_score) || 0) ? c : best);
    return { total: filteredCompanies.length, avgScore, topPick };
  }, [filteredCompanies]);

  const activeFilterCount = useMemo(() => {
    return [sectorFilter !== 'ALL', convictionFilter !== 'ALL', scoreMin > 0, scoreMax < 100, mosFilter !== 'all', gateFilter !== 'all'].filter(Boolean).length;
  }, [sectorFilter, convictionFilter, scoreMin, scoreMax, mosFilter, gateFilter]);

  // ── Simulator ticker groups ──
  const simTickerGroups = useMemo(() => {
    const activePicks = simPicks.filter(p => p.status === 'active');
    const grouped: Record<string, SimulatorPick[]> = {};
    activePicks.forEach(p => {
      if (!grouped[p.ticker]) grouped[p.ticker] = [];
      grouped[p.ticker].push(p);
    });
    return Object.entries(grouped).map(([ticker, entries]) => {
      const totalShares = entries.reduce((s, p) => s + (Number(p.shares) || 1), 0);
      const totalAllocated = entries.reduce((s, p) => s + (Number(p.allocated_amount) || Number(p.entry_price) * (Number(p.shares) || 1)), 0);
      const currentPrice = Number(entries[0].current_price) || Number(entries[0].entry_price);
      const currentValue = currentPrice * totalShares;
      const pnl = currentValue - totalAllocated;
      const pnlPct = totalAllocated > 0 ? (pnl / totalAllocated) * 100 : 0;
      const avgEntryPrice = totalShares > 0 ? totalAllocated / totalShares : 0;
      const avgScore = entries.reduce((s, p) => s + (Number(p.ai_score_at_entry) || 0), 0) / entries.length;
      const latestConviction = entries[0].current_ai_conviction || entries[0].ai_conviction_at_entry;
      return {
        ticker,
        companyName: entries[0].company_name,
        entries,
        totalShares,
        totalAllocated,
        currentPrice,
        currentValue,
        pnl,
        pnlPct,
        avgEntryPrice,
        avgScore,
        latestConviction,
      };
    }).sort((a, b) => b.totalAllocated - a.totalAllocated);
  }, [simPicks]);

  // Portfolio stats
  const portfolioStats = useMemo(() => {
    const activePicks = portfolioPicks.filter(p => p.status === 'active');
    const totalValue = activePicks.reduce((s, p) => s + (Number(p.current_price) || 0) * (Number(p.shares) || 1), 0);
    const totalCost = activePicks.reduce((s, p) => s + (Number(p.entry_price) || 0) * (Number(p.shares) || 1), 0);
    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
    return { totalValue, totalCost, totalGainLoss, totalGainLossPct, count: activePicks.length };
  }, [portfolioPicks]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'dashboard') loadDashboard();
    else if (activeTab === 'simulator') loadSimulator().then(() => setRefreshing(false));
    else if (activeTab === 'portfolio') loadPortfolio().then(() => setRefreshing(false));
    else if (activeTab === 'backtest') loadBacktests().then(() => setRefreshing(false));
    else setRefreshing(false);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <View style={s.safe}>
      {/* Scrollable tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarScroll} contentContainerStyle={s.tabBar}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <TouchableOpacity key={tab.id} style={[s.tab, active && s.tabActive]} onPress={() => setActiveTab(tab.id)} activeOpacity={0.7}>
              <Icon size={14} color={active ? colors.primary[700] : colors.slate[400]} strokeWidth={1.8} />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tab content */}
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
      >
        {/* ══════════ DASHBOARD TAB ══════════ */}
        {activeTab === 'dashboard' && (
          <>
            {/* Search + Filters */}
            <View style={s.searchRow}>
              <View style={s.searchInput}>
                <Search size={16} color={colors.slate[400]} strokeWidth={1.8} />
                <TextInput
                  style={s.searchText}
                  placeholder="Search tickers or companies..."
                  placeholderTextColor={colors.slate[400]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="characters"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                    <X size={16} color={colors.slate[400]} strokeWidth={2} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity style={[s.filterBtn, (showFilters || activeFilterCount > 0) && s.filterBtnActive]} onPress={() => setShowFilters(!showFilters)} activeOpacity={0.7}>
                <SlidersHorizontal size={18} color={(showFilters || activeFilterCount > 0) ? colors.primary[600] : colors.slate[500]} strokeWidth={1.8} />
                {activeFilterCount > 0 && (
                  <View style={s.filterBadge}><Text style={s.filterBadgeText}>{activeFilterCount}</Text></View>
                )}
              </TouchableOpacity>
            </View>

            {showFilters && (
              <Card>
                <View style={s.filterHeader}>
                  <Text style={s.filterTitle}>Filters</Text>
                  <TouchableOpacity onPress={() => { setSectorFilter('ALL'); setConvictionFilter('ALL'); setScoreMin(0); setScoreMax(100); setMosFilter('all'); setGateFilter('all'); }}>
                    <Text style={s.clearFiltersText}>Clear All</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Sort by</Text>
                <View style={s.filterChips}>
                  {([['score_high', 'Score \u2193'], ['score_low', 'Score \u2191'], ['mos_high', 'MoS \u2193'], ['market_cap', 'Mkt Cap'], ['price_high', 'Price \u2193'], ['price_low', 'Price \u2191'], ['alpha', 'A-Z']] as const).map(([val, label]) => (
                    <TouchableOpacity key={val} style={[s.chip, sortBy === val && s.chipActive]} onPress={() => setSortBy(val)}>
                      <Text style={[s.chipText, sortBy === val && s.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Sector</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.filterChips}>
                    {sectors.map(sec => (
                      <TouchableOpacity key={sec} style={[s.chip, sectorFilter === sec && s.chipActive]} onPress={() => setSectorFilter(sec)}>
                        <Text style={[s.chipText, sectorFilter === sec && s.chipTextActive]}>{sec === 'ALL' ? 'All' : sec}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Conviction</Text>
                <View style={s.filterChips}>
                  {(['ALL', 'Strong Buy', 'Buy', 'Hold', 'Reduce', 'Sell'] as const).map(val => (
                    <TouchableOpacity key={val} style={[s.chip, convictionFilter === val && s.chipActive]} onPress={() => setConvictionFilter(val)}>
                      <Text style={[s.chipText, convictionFilter === val && s.chipTextActive]}>
                        {val}{val !== 'ALL' ? ` (${convictionCounts[val] || 0})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Score Range</Text>
                <View style={s.scoreRangeRow}>
                  <TextInput
                    style={s.scoreRangeInput}
                    value={String(scoreMin)}
                    onChangeText={t => setScoreMin(Math.max(0, Math.min(100, Number(t) || 0)))}
                    keyboardType="number-pad"
                    placeholder="Min"
                    placeholderTextColor={colors.slate[400]}
                  />
                  <Text style={s.scoreRangeSeparator}>to</Text>
                  <TextInput
                    style={s.scoreRangeInput}
                    value={String(scoreMax)}
                    onChangeText={t => setScoreMax(Math.max(0, Math.min(100, Number(t) || 100)))}
                    keyboardType="number-pad"
                    placeholder="Max"
                    placeholderTextColor={colors.slate[400]}
                  />
                </View>

                <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Valuation</Text>
                <View style={s.filterChips}>
                  {([['all', 'All'], ['undervalued', 'Undervalued'], ['overvalued', 'Overvalued']] as const).map(([val, label]) => (
                    <TouchableOpacity key={val} style={[s.chip, mosFilter === val && s.chipActive]} onPress={() => setMosFilter(val)}>
                      <Text style={[s.chipText, mosFilter === val && s.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Safety Gates</Text>
                <View style={s.filterChips}>
                  {([['all', 'All'], ['no_gates', 'No Gates'], ['gates_active', 'Gates Active']] as const).map(([val, label]) => (
                    <TouchableOpacity key={val} style={[s.chip, gateFilter === val && s.chipActive]} onPress={() => setGateFilter(val)}>
                      <Text style={[s.chipText, gateFilter === val && s.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            )}

            {/* Stats bar */}
            {dashStats.total > 0 && (
              <View style={s.statsBar}>
                <Text style={s.statsText}>{dashStats.total} stocks</Text>
                <Text style={s.statsText}>Avg: {Math.round(dashStats.avgScore)}</Text>
                {dashStats.topPick && <Text style={s.statsTextHighlight}>Top: {dashStats.topPick.ticker} ({Math.round(Number(dashStats.topPick.current_score))})</Text>}
              </View>
            )}

            <View style={s.distRow}>
              {Object.entries(convictionCounts).map(([conv, count]) =>
                count > 0 ? (
                  <TouchableOpacity key={conv} onPress={() => setConvictionFilter(conv as ConvictionFilter)} activeOpacity={0.7}>
                    <ConvictionBadge conviction={conv} />
                    <Text style={s.distCount}>{count}</Text>
                  </TouchableOpacity>
                ) : null
              )}
              <Text style={s.totalCount}>{recommendations.length} stocks</Text>
            </View>

            {loading ? <LoadingSpinner /> : filteredCompanies.length === 0 ? (
              <EmptyState icon={BarChart3} title="No stocks found" text={searchQuery ? 'Try a different search term' : 'Stocks will appear once analyzed'} />
            ) : (
              <View style={s.stockList}>
                {filteredCompanies.map(rec => (
                  <StockCard
                    key={rec.ticker}
                    ticker={rec.ticker}
                    companyName={rec.company_name || rec.ticker}
                    sector={rec.sector || 'Unknown'}
                    score={Math.round(Number(rec.current_score) || 0)}
                    conviction={rec.current_conviction || 'Hold'}
                    price={Number(rec.current_price) || 0}
                    marginOfSafety={rec.margin_of_safety_pct ? Number(rec.margin_of_safety_pct) : null}
                    onPress={() => openCompany(rec.ticker)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ══════════ INVEST FOR ME TAB ══════════ */}
        {activeTab === 'invest' && (
          <>
            {constructedPortfolio && investStep === 99 ? (
              /* ── Portfolio Results ── */
              <PortfolioResultsView
                portfolio={constructedPortfolio}
                profile={investProfile}
                openCompany={openCompany}
                showToast={showToast}
                onReset={() => { setConstructedPortfolio(null); setInvestStep(0); }}
              />
            ) : constructing ? (
              <Card>
                <View style={s.emptyState}>
                  <Sparkles size={40} color={colors.primary[400]} strokeWidth={1.5} />
                  <Text style={s.emptyTitle}>Building your portfolio...</Text>
                  <Text style={s.emptyText}>Our AI agents are scoring stocks and constructing an optimal allocation for your profile.</Text>
                  <LoadingSpinner />
                </View>
              </Card>
            ) : investError ? (
              <Card>
                <View style={s.emptyState}>
                  <AlertTriangle size={32} color={colors.error[500]} strokeWidth={1.5} />
                  <Text style={s.emptyTitle}>Construction Failed</Text>
                  <Text style={s.emptyText}>{investError}</Text>
                  <Button title="Try Again" onPress={() => { setInvestError(null); handleConstructPortfolio(); }} size="sm" />
                </View>
              </Card>
            ) : (
              /* ── Invest Wizard ── */
              <InvestWizardMobile
                profile={investProfile}
                setProfile={setInvestProfile}
                step={investStep}
                setStep={setInvestStep}
                onSubmit={handleConstructPortfolio}
              />
            )}
          </>
        )}

        {/* ══════════ PORTFOLIO TAB ══════════ */}
        {activeTab === 'portfolio' && (
          <>
            {/* Portfolio stats */}
            {portfolioStats.count > 0 && (
              <Card>
                <View style={s.simSumRow}>
                  <View style={s.simSumItem}>
                    <Text style={s.simSumLabel}>Total Value</Text>
                    <Text style={s.simSumValue}>${portfolioStats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={s.simSumItem}>
                    <Text style={s.simSumLabel}>Gain/Loss</Text>
                    <Text style={[s.simSumValue, { color: portfolioStats.totalGainLoss >= 0 ? colors.primary[600] : colors.error[600] }]}>
                      {portfolioStats.totalGainLoss >= 0 ? '+' : ''}{portfolioStats.totalGainLossPct.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={s.simSumItem}>
                    <Text style={s.simSumLabel}>Positions</Text>
                    <Text style={s.simSumValue}>{portfolioStats.count}</Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Sub-tab bar */}
            <View style={s.subTabBar}>
              {([
                { key: 'holdings' as const, label: 'Holdings', count: portfolioPicks.filter(p => p.status === 'active').length },
                { key: 'recommendations' as const, label: 'Recs', count: portfolioRecs.length },
                { key: 'alerts' as const, label: 'Alerts', count: portfolioAlerts.length },
              ]).map(tab => (
                <TouchableOpacity key={tab.key} style={[s.subTab, portfolioSubTab === tab.key && s.subTabActive]} onPress={() => setPortfolioSubTab(tab.key)} activeOpacity={0.7}>
                  <Text style={[s.subTabText, portfolioSubTab === tab.key && s.subTabTextActive]}>
                    {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Add Stock button */}
            <TouchableOpacity style={s.addStockBtn} onPress={() => setShowAddStockModal(true)} activeOpacity={0.7}>
              <Plus size={16} color={colors.primary[600]} strokeWidth={2} />
              <Text style={s.addStockBtnText}>Add Stock</Text>
            </TouchableOpacity>

            {portfolioSubTab === 'holdings' && (
              <>
                {portfolioLoading ? <LoadingSpinner /> : portfolioPicks.filter(p => p.status === 'active').length === 0 ? (
                  <EmptyState icon={Briefcase} title="No holdings yet" text="Build a portfolio using Invest For Me or add picks in the Simulator" />
                ) : (
                  <View style={s.stockList}>
                    {portfolioPicks.filter(p => p.status === 'active').map(pick => (
                      <SimulatorCard
                        key={pick.id}
                        pick={pick}
                        onClose={() => handleClosePick(pick)}
                        onPress={() => openCompany(pick.ticker)}
                        closing={closingId === pick.id}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {portfolioSubTab === 'recommendations' && (
              <>
                <View style={s.filterChips}>
                  {(['short', 'medium', 'long'] as const).map(h => (
                    <TouchableOpacity key={h} style={[s.chip, recHorizon === h && s.chipActive]} onPress={() => setRecHorizon(h)}>
                      <Text style={[s.chipText, recHorizon === h && s.chipTextActive]}>
                        {h === 'short' ? '1-3mo' : h === 'medium' ? '3-12mo' : '1-5yr'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {portfolioRecs.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="No recommendations" text="Add holdings to get personalized recs" />
                ) : (
                  <View style={s.stockList}>
                    {portfolioRecs.map((rec: any) => (
                      <StockCard
                        key={rec.ticker}
                        ticker={rec.ticker}
                        companyName={rec.company_name || rec.ticker}
                        sector={rec.sector || 'Unknown'}
                        score={Math.round(Number(rec.current_score) || 0)}
                        conviction={rec.current_conviction || 'Hold'}
                        price={Number(rec.current_price) || 0}
                        marginOfSafety={rec.margin_of_safety_pct ? Number(rec.margin_of_safety_pct) : null}
                        onPress={() => openCompany(rec.ticker)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {portfolioSubTab === 'alerts' && (
              <>
                {portfolioAlerts.length === 0 ? (
                  <EmptyState icon={Bell} title="No alerts" text="Alerts appear when your holdings trigger CIRA score thresholds" />
                ) : (
                  <View style={s.stockList}>
                    {portfolioAlerts.map((alert: any) => (
                      <Card key={alert.id}>
                        <View style={s.alertRow}>
                          <View style={[s.alertDot, { backgroundColor: alert.priority === 'high' ? colors.error[500] : alert.priority === 'medium' ? colors.warning[500] : colors.slate[400] }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.alertTitle}>{alert.title}</Text>
                            <Text style={s.alertMsg}>{alert.message}</Text>
                            <Text style={s.alertTicker}>{alert.ticker}</Text>
                          </View>
                          <TouchableOpacity onPress={() => openCompany(alert.ticker)} activeOpacity={0.7}>
                            <Eye size={16} color={colors.primary[600]} strokeWidth={2} />
                          </TouchableOpacity>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Add Stock Modal */}
            <Modal visible={showAddStockModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddStockModal(false)}>
              <SafeAreaView style={s.modalSafe}>
                <View style={s.modalHeader}>
                  <TouchableOpacity onPress={() => setShowAddStockModal(false)} style={s.modalClose} activeOpacity={0.7}>
                    <X size={20} color={colors.slate[600]} strokeWidth={2} />
                  </TouchableOpacity>
                  <Text style={s.modalTitle}>Add Stock</Text>
                  <View style={{ width: 36 }} />
                </View>
                <ScrollView contentContainerStyle={s.modalScroll}>
                  <Text style={s.filterTitle}>Ticker</Text>
                  <TextInput style={s.addInput} value={addStockForm.ticker} onChangeText={t => setAddStockForm(f => ({ ...f, ticker: t.toUpperCase() }))} autoCapitalize="characters" placeholder="AAPL" placeholderTextColor={colors.slate[400]} />
                  <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Shares</Text>
                  <TextInput style={s.addInput} value={addStockForm.shares} onChangeText={t => setAddStockForm(f => ({ ...f, shares: t }))} keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.slate[400]} />
                  <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Purchase Price</Text>
                  <TextInput style={s.addInput} value={addStockForm.price} onChangeText={t => setAddStockForm(f => ({ ...f, price: t }))} keyboardType="decimal-pad" placeholder="150.00" placeholderTextColor={colors.slate[400]} />
                  <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Notes (optional)</Text>
                  <TextInput style={[s.addInput, { height: 60 }]} value={addStockForm.notes} onChangeText={t => setAddStockForm(f => ({ ...f, notes: t }))} placeholder="Any notes..." placeholderTextColor={colors.slate[400]} multiline />
                  <View style={{ marginTop: spacing.lg }}>
                    <Button
                      title="Add to Portfolio"
                      onPress={async () => {
                        const ticker = addStockForm.ticker.trim();
                        if (!ticker) return;
                        try {
                          await addSimulatorPick(ticker);
                          showToast(`Added ${ticker}`, 'success');
                          setShowAddStockModal(false);
                          setAddStockForm({ ticker: '', shares: '', price: '', date: '', notes: '' });
                          await loadPortfolio();
                        } catch (err: any) {
                          showToast(err?.message || 'Failed', 'error');
                        }
                      }}
                      fullWidth
                      disabled={!addStockForm.ticker.trim()}
                    />
                  </View>
                </ScrollView>
              </SafeAreaView>
            </Modal>
          </>
        )}

        {/* ══════════ SIMULATOR TAB ══════════ */}
        {activeTab === 'simulator' && (
          <>
            {simSummary && (
              <Card>
                <Text style={s.sectionTitle}>Simulator Summary</Text>
                <View style={s.simSummary}>
                  <View style={s.simSumRow}>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Invested</Text>
                      <Text style={s.simSumValue}>${Number(simSummary.total_invested || 0).toLocaleString()}</Text>
                    </View>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Current</Text>
                      <Text style={s.simSumValue}>${Number(simSummary.current_value || 0).toLocaleString()}</Text>
                    </View>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>P&L</Text>
                      <Text style={[s.simSumValue, { color: Number(simSummary.total_pnl_dollars || 0) >= 0 ? colors.primary[600] : colors.error[600] }]}>
                        {Number(simSummary.total_pnl_dollars || 0) >= 0 ? '+' : ''}{Number(simSummary.total_pnl_percent || 0).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                  <View style={s.simSumRow}>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Win Rate</Text>
                      <Text style={s.simSumValue}>{Number(simSummary.win_rate || 0).toFixed(0)}%</Text>
                    </View>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Best</Text>
                      <Text style={[s.simSumValue, { color: colors.primary[600] }]}>
                        {simSummary.best_pick ? `${simSummary.best_pick.ticker} +${Number(simSummary.best_pick.pnl_percent || 0).toFixed(0)}%` : '\u2013'}
                      </Text>
                    </View>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Worst</Text>
                      <Text style={[s.simSumValue, { color: colors.error[600] }]}>
                        {simSummary.worst_pick ? `${simSummary.worst_pick.ticker} ${Number(simSummary.worst_pick.pnl_percent || 0).toFixed(0)}%` : '\u2013'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            )}

            <Card>
              <Text style={s.sectionTitle}>Add Pick</Text>
              <View style={s.addRow}>
                <TextInput style={s.addInput} placeholder="Enter ticker (e.g. AAPL)" placeholderTextColor={colors.slate[400]} value={addTickerInput} onChangeText={setAddTickerInput} autoCapitalize="characters" />
                <Button title={addingPick ? '...' : 'Add'} onPress={handleAddPick} disabled={addingPick || !addTickerInput.trim()} size="sm" />
              </View>
            </Card>

            <View style={s.simActions}>
              <TouchableOpacity style={s.simActionBtn} onPress={handleRefreshPrices} disabled={simRefreshing}>
                <RefreshCw size={14} color={colors.primary[600]} strokeWidth={2} />
                <Text style={s.simActionText}>{simRefreshing ? 'Refreshing...' : 'Refresh Prices'}</Text>
              </TouchableOpacity>
            </View>

            {simLoading ? <LoadingSpinner /> : simTickerGroups.length === 0 ? (
              <EmptyState icon={Target} title="No active picks" text="Add a ticker above to start paper trading" />
            ) : (
              <View style={s.stockList}>
                {simTickerGroups.map(group => {
                  const isExpanded = expandedSimTicker === group.ticker;
                  const groupPnl = Number(group.pnl) || 0;
                  const groupPnlPct = Number(group.pnlPct) || 0;
                  return (
                    <Card key={group.ticker}>
                      <TouchableOpacity onPress={() => setExpandedSimTicker(isExpanded ? null : group.ticker)} activeOpacity={0.7}>
                        <View style={s.simGroupHeader}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                              <Text style={s.posTicker}>{group.ticker}</Text>
                              <ConvictionBadge conviction={group.latestConviction || 'Hold'} />
                              {group.entries.length > 1 && (
                                <Badge label={`${group.entries.length} entries`} variant="info" />
                              )}
                            </View>
                            <Text style={s.posName} numberOfLines={1}>{group.companyName}</Text>
                            <Text style={s.posSector}>{group.totalShares} shares \u00B7 avg ${Number(group.avgEntryPrice || 0).toFixed(2)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[s.simSumValue, { color: groupPnl >= 0 ? colors.primary[600] : colors.error[600], fontSize: typography.fontSize.base }]}>
                              {groupPnl >= 0 ? '+' : ''}${Math.abs(groupPnl).toFixed(0)}
                            </Text>
                            <Text style={[s.posSector, { color: groupPnlPct >= 0 ? colors.primary[600] : colors.error[600] }]}>
                              {groupPnlPct >= 0 ? '+' : ''}{groupPnlPct.toFixed(1)}%
                            </Text>
                            {isExpanded ? <ChevronUp size={16} color={colors.slate[400]} /> : <ChevronDown size={16} color={colors.slate[400]} />}
                          </View>
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={s.simGroupExpanded}>
                          {/* Aggregated stats */}
                          <View style={s.simSumRow}>
                            <View style={s.simSumItem}>
                              <Text style={s.simSumLabel}>Invested</Text>
                              <Text style={s.simSumValue}>${Number(group.totalAllocated || 0).toFixed(0)}</Text>
                            </View>
                            <View style={s.simSumItem}>
                              <Text style={s.simSumLabel}>Current</Text>
                              <Text style={s.simSumValue}>${Number(group.currentValue || 0).toFixed(0)}</Text>
                            </View>
                            <View style={s.simSumItem}>
                              <Text style={s.simSumLabel}>Avg Score</Text>
                              <ScoreRing score={Number(group.avgScore) || 0} size={28} />
                            </View>
                          </View>

                          {/* Individual entries */}
                          <Text style={[s.filterTitle, { marginTop: spacing.md }]}>
                            {group.entries.length === 1 ? 'Entry Detail' : `${group.entries.length} Entries`}
                          </Text>
                          {group.entries.map((entry: SimulatorPick) => {
                            const entryShares = Number(entry.shares) || 1;
                            const entryAllocated = Number(entry.allocated_amount) || Number(entry.entry_price || 0) * entryShares;
                            const entryCurrentVal = (Number(group.currentPrice) || 0) * entryShares;
                            const entryPnl = entryCurrentVal - entryAllocated;
                            return (
                              <View key={entry.id} style={s.simEntryRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={s.simEntryText}>
                                    {entryShares} share{entryShares !== 1 ? 's' : ''} @ ${Number(entry.entry_price || 0).toFixed(2)}
                                  </Text>
                                  <Text style={s.posSector}>
                                    Score: {Math.round(Number(entry.ai_score_at_entry) || 0)} \u00B7 {entry.source || 'manual'} \u00B7 {entry.created_at?.slice(0, 10) || ''}
                                  </Text>
                                </View>
                                <Text style={[s.simSumValue, { color: entryPnl >= 0 ? colors.primary[600] : colors.error[600] }]}>
                                  {entryPnl >= 0 ? '+' : ''}${Math.abs(entryPnl).toFixed(0)}
                                </Text>
                                <TouchableOpacity onPress={() => handleClosePick(entry)} style={s.simEntryClose}>
                                  <X size={12} color={colors.error[500]} strokeWidth={2} />
                                </TouchableOpacity>
                              </View>
                            );
                          })}

                          {/* AI thesis */}
                          {(group.entries[0] as any)?.pick_reasoning && (
                            <View style={s.thesisBox}>
                              <Text style={s.filterTitle}>AI Thesis</Text>
                              <Text style={s.reasoning}>{(group.entries[0] as any).pick_reasoning}</Text>
                            </View>
                          )}

                          {/* View detail */}
                          <TouchableOpacity onPress={() => openCompany(group.ticker)} style={s.simViewDetail} activeOpacity={0.7}>
                            <Eye size={14} color={colors.primary[600]} strokeWidth={2} />
                            <Text style={s.simActionText}>View Detail</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ══════════ BACKTEST TAB ══════════ */}
        {activeTab === 'backtest' && (
          <>
            <Card>
              <Text style={s.sectionTitle}>Run Backtest</Text>

              <Text style={s.filterTitle}>Name</Text>
              <TextInput style={s.addInput} value={btName} onChangeText={setBtName} placeholder="Backtest name" placeholderTextColor={colors.slate[400]} />

              <View style={[s.scoreRangeRow, { marginTop: spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.filterTitle}>Start Date</Text>
                  <TextInput style={s.addInput} value={btStartDate} onChangeText={setBtStartDate} placeholder="2023-01-01" placeholderTextColor={colors.slate[400]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.filterTitle}>End Date</Text>
                  <TextInput style={s.addInput} value={btEndDate} onChangeText={setBtEndDate} placeholder="2025-12-31" placeholderTextColor={colors.slate[400]} />
                </View>
              </View>

              <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Rebalance</Text>
              <View style={s.filterChips}>
                {(['quarterly', 'monthly'] as const).map(f => (
                  <TouchableOpacity key={f} style={[s.chip, btFreq === f && s.chipActive]} onPress={() => setBtFreq(f)}>
                    <Text style={[s.chipText, btFreq === f && s.chipTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Universe</Text>
              <View style={s.filterChips}>
                {DEFAULT_UNIVERSE.map(t => (
                  <View key={t} style={s.universeBadge}>
                    <Text style={s.universeBadgeText}>{t}</Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Button
                  title={btStarting ? 'Starting...' : btActive?.status === 'running' ? 'Running...' : 'Start Backtest'}
                  onPress={handleStartBacktest}
                  disabled={btStarting || btActive?.status === 'running'}
                  icon={<Play size={16} color={colors.white} strokeWidth={2} />}
                  fullWidth
                />
              </View>
              {btActive?.status === 'running' && (
                <View style={s.btRunningBanner}>
                  <Clock size={14} color={colors.info[600]} strokeWidth={2} />
                  <Text style={s.btRunningText}>Backtest in progress... polling for results</Text>
                  {(btActive as any).progress != null && (btActive as any).totalSteps > 0 && (
                    <Text style={s.btRunningText}>
                      {Math.round(((btActive as any).progress / (btActive as any).totalSteps) * 100)}%
                    </Text>
                  )}
                </View>
              )}
            </Card>

            {/* Results */}
            {btResult?.run && (
              <Card>
                <Text style={s.sectionTitle}>Latest Results: {btResult.run.name}</Text>
                <View style={s.simSumRow}>
                  <View style={s.simSumItem}>
                    <Text style={s.simSumLabel}>CIRA Return</Text>
                    <Text style={[s.simSumValue, { color: Number(btResult.run.cira_total_return || btResult.run.total_return_pct) >= 0 ? colors.primary[600] : colors.error[600] }]}>
                      {Number(btResult.run.cira_total_return || btResult.run.total_return_pct) >= 0 ? '+' : ''}{Number(btResult.run.cira_total_return || btResult.run.total_return_pct).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={s.simSumItem}>
                    <Text style={s.simSumLabel}>Benchmark</Text>
                    <Text style={s.simSumValue}>
                      {Number(btResult.run.benchmark_return_pct || btResult.run.benchmark_total_return) >= 0 ? '+' : ''}{Number(btResult.run.benchmark_return_pct || btResult.run.benchmark_total_return).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={s.simSumItem}>
                    <Text style={s.simSumLabel}>Alpha</Text>
                    <Text style={[s.simSumValue, { color: Number(btResult.run.alpha || 0) >= 0 ? colors.primary[600] : colors.error[600] }]}>
                      {Number(btResult.run.alpha || 0) > 0 ? '+' : ''}{Number(btResult.run.alpha || 0).toFixed(1)}%
                    </Text>
                  </View>
                </View>
                {btResult.run.q1_avg_return != null && (
                  <View style={[s.simSumRow, { marginTop: spacing.sm }]}>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Q1 Return</Text>
                      <Text style={[s.simSumValue, { color: colors.primary[600] }]}>{Number(btResult.run.q1_avg_return).toFixed(1)}%</Text>
                    </View>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Q5 Return</Text>
                      <Text style={[s.simSumValue, { color: colors.error[600] }]}>{Number(btResult.run.q5_avg_return).toFixed(1)}%</Text>
                    </View>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Spread</Text>
                      <Text style={s.simSumValue}>{Number(btResult.run.quintile_spread).toFixed(1)}%</Text>
                    </View>
                  </View>
                )}
                {btResult.run.sharpe_ratio != null && (
                  <View style={[s.simSumRow, { marginTop: spacing.sm }]}>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Sharpe</Text>
                      <Text style={s.simSumValue}>{Number(btResult.run.sharpe_ratio).toFixed(2)}</Text>
                    </View>
                    <View style={s.simSumItem}>
                      <Text style={s.simSumLabel}>Max DD</Text>
                      <Text style={[s.simSumValue, { color: colors.error[600] }]}>
                        {Number(btResult.run.max_drawdown_pct).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={s.simSumItem} />
                  </View>
                )}

                {/* Dimension IC */}
                {btResult.run.dimension_ic && (() => {
                  const ic = Array.isArray(btResult.run.dimension_ic) ? btResult.run.dimension_ic : JSON.parse(btResult.run.dimension_ic || '[]');
                  if (ic.length === 0) return null;
                  return (
                    <View style={{ marginTop: spacing.lg }}>
                      <Text style={s.filterTitle}>Dimension IC (Predictiveness)</Text>
                      {ic.sort((a: any, b: any) => Math.abs(b.ic) - Math.abs(a.ic)).slice(0, 8).map((d: any) => (
                        <View key={d.key} style={s.icRow}>
                          <Text style={s.icName} numberOfLines={1}>{d.name}</Text>
                          <View style={s.icBarBg}>
                            <View style={[s.icBarFill, {
                              width: `${Math.min(Math.abs(d.ic) * 200, 50)}%`,
                              backgroundColor: d.ic >= 0 ? colors.primary[500] : colors.error[500],
                              ...(d.ic >= 0 ? { left: '50%' } : { right: '50%' }),
                            }]} />
                          </View>
                          <Text style={[s.icValue, { color: d.ic >= 0 ? colors.primary[600] : colors.error[600] }]}>
                            {d.ic > 0 ? '+' : ''}{d.ic.toFixed(3)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </Card>
            )}

            {/* Past runs */}
            {btRuns.length > 0 && (
              <Card padded={false}>
                <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                  <Text style={s.sectionTitle}>Past Runs</Text>
                </View>
                {btRuns.map((run, i) => (
                  <React.Fragment key={run.id}>
                    {i > 0 && <View style={s.divider} />}
                    <TouchableOpacity style={s.btRunRow} onPress={async () => {
                      if (run.status === 'completed') {
                        const result = await getBacktestResult(run.id);
                        setBtResult(result);
                      }
                    }} activeOpacity={0.7}>
                      <View style={s.btRunInfo}>
                        <Text style={s.btRunName}>{run.name}</Text>
                        <Text style={s.btRunDate}>
                          {run.start_date?.slice(0, 10)} \u2192 {run.end_date?.slice(0, 10)}
                        </Text>
                      </View>
                      <Badge
                        label={run.status}
                        variant={run.status === 'completed' ? 'success' : run.status === 'running' ? 'info' : 'error'}
                      />
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </Card>
            )}

            {btLoading && <LoadingSpinner />}
          </>
        )}

      </ScrollView>

      {/* ── Company Detail Modal ── */}
      <CompanyDetailModal
        visible={!!selectedTicker}
        ticker={selectedTicker}
        data={companyData}
        loading={companyLoading}
        onClose={() => setSelectedTicker(null)}
        showToast={showToast}
        openCompany={openCompany}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INVEST WIZARD (mobile-optimized multi-step form — 9 steps)
// ═══════════════════════════════════════════════════════════════════

const HORIZONS = [
  { value: 'short', label: 'Short (< 1yr)', desc: 'Capital preservation focus' },
  { value: 'medium', label: 'Medium (1-3yr)', desc: 'Balanced growth' },
  { value: 'long', label: 'Long (3-7yr)', desc: 'Compounding returns' },
  { value: 'very_long', label: 'Very Long (7yr+)', desc: 'Maximum growth' },
] as const;

const RISK_LEVELS = [
  { value: 'very_conservative', label: 'Very Conservative', desc: 'Minimal risk' },
  { value: 'conservative', label: 'Conservative', desc: 'Low risk' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Higher risk' },
  { value: 'very_aggressive', label: 'Very Aggressive', desc: 'Max growth' },
] as const;

const CONCENTRATIONS = [
  { value: 'focused', label: 'Focused (5-8)', desc: 'Concentrated bets' },
  { value: 'balanced', label: 'Balanced (8-12)', desc: 'Good diversification' },
  { value: 'diversified', label: 'Diversified (12-15)', desc: 'Wide spread' },
] as const;

function InvestWizardMobile({ profile, setProfile, step, setStep, onSubmit }: {
  profile: InvestorProfile;
  setProfile: (p: InvestorProfile) => void;
  step: number;
  setStep: (s: number) => void;
  onSubmit: () => void;
}) {
  const totalSteps = 9;
  const [sectorMode, setSectorMode] = useState<'none' | 'overweight' | 'exclude'>(
    profile.sectorPreferences.overweight.length > 0 ? 'overweight' :
    profile.sectorPreferences.exclude.length > 0 ? 'exclude' : 'none'
  );
  const [holdingsMode, setHoldingsMode] = useState<'fresh' | 'existing'>(profile.existingHoldings.length > 0 ? 'existing' : 'fresh');
  const [holdingsSearch, setHoldingsSearch] = useState('');

  const toggleSector = (sector: string) => {
    if (sectorMode === 'overweight') {
      const ow = profile.sectorPreferences.overweight.includes(sector)
        ? profile.sectorPreferences.overweight.filter(s => s !== sector)
        : [...profile.sectorPreferences.overweight, sector];
      setProfile({ ...profile, sectorPreferences: { ...profile.sectorPreferences, overweight: ow, exclude: [] } });
    } else if (sectorMode === 'exclude') {
      const ex = profile.sectorPreferences.exclude.includes(sector)
        ? profile.sectorPreferences.exclude.filter(s => s !== sector)
        : [...profile.sectorPreferences.exclude, sector];
      setProfile({ ...profile, sectorPreferences: { ...profile.sectorPreferences, exclude: ex, overweight: [] } });
    }
  };

  return (
    <>
      {/* Progress */}
      <View style={s.wizardProgress}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[s.progressDot, i <= step && s.progressDotActive]} />
        ))}
      </View>
      <Text style={s.wizardStepLabel}>Step {step + 1} of {totalSteps}</Text>

      {/* Step 0: Amount */}
      {step === 0 && (
        <Card>
          <Text style={s.wizardTitle}>Investment Amount</Text>
          <Text style={s.wizardDesc}>How much would you like to invest?</Text>
          <View style={s.amountRow}>
            <DollarSign size={20} color={colors.primary[600]} strokeWidth={2} />
            <TextInput
              style={s.amountInput}
              value={profile.investmentAmount.toString()}
              onChangeText={t => setProfile({ ...profile, investmentAmount: Number(t.replace(/[^0-9]/g, '')) || 0 })}
              keyboardType="number-pad"
              placeholder="10000"
              placeholderTextColor={colors.slate[400]}
            />
          </View>
          <View style={s.quickAmounts}>
            {[5000, 10000, 25000, 50000, 100000].map(amt => (
              <TouchableOpacity key={amt} style={[s.chip, profile.investmentAmount === amt && s.chipActive]} onPress={() => setProfile({ ...profile, investmentAmount: amt })}>
                <Text style={[s.chipText, profile.investmentAmount === amt && s.chipTextActive]}>${(amt / 1000).toFixed(0)}k</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button title="Next" onPress={() => setStep(1)} disabled={profile.investmentAmount <= 0} fullWidth icon={<ArrowRight size={16} color={colors.white} strokeWidth={2} />} />
        </Card>
      )}

      {/* Step 1: Horizon */}
      {step === 1 && (
        <Card>
          <Text style={s.wizardTitle}>Investment Horizon</Text>
          <Text style={s.wizardDesc}>How long do you plan to hold?</Text>
          {HORIZONS.map(h => (
            <TouchableOpacity key={h.value} style={[s.optionRow, profile.horizon === h.value && s.optionRowActive]} onPress={() => setProfile({ ...profile, horizon: h.value })}>
              <View>
                <Text style={s.optionLabel}>{h.label}</Text>
                <Text style={s.optionDesc}>{h.desc}</Text>
              </View>
              {profile.horizon === h.value && <Check size={18} color={colors.primary[600]} strokeWidth={2.5} />}
            </TouchableOpacity>
          ))}
          <View style={s.wizardNav}>
            <Button title="Back" onPress={() => setStep(0)} variant="outline" size="sm" />
            <Button title="Next" onPress={() => setStep(2)} size="sm" icon={<ArrowRight size={14} color={colors.white} strokeWidth={2} />} />
          </View>
        </Card>
      )}

      {/* Step 2: Risk Tolerance */}
      {step === 2 && (
        <Card>
          <Text style={s.wizardTitle}>Risk Tolerance</Text>
          <Text style={s.wizardDesc}>How much volatility can you handle?</Text>
          {RISK_LEVELS.map(r => (
            <TouchableOpacity key={r.value} style={[s.optionRow, profile.riskTolerance === r.value && s.optionRowActive]} onPress={() => setProfile({ ...profile, riskTolerance: r.value })}>
              <View>
                <Text style={s.optionLabel}>{r.label}</Text>
                <Text style={s.optionDesc}>{r.desc}</Text>
              </View>
              {profile.riskTolerance === r.value && <Check size={18} color={colors.primary[600]} strokeWidth={2.5} />}
            </TouchableOpacity>
          ))}
          <View style={s.wizardNav}>
            <Button title="Back" onPress={() => setStep(1)} variant="outline" size="sm" />
            <Button title="Next" onPress={() => setStep(3)} size="sm" icon={<ArrowRight size={14} color={colors.white} strokeWidth={2} />} />
          </View>
        </Card>
      )}

      {/* Step 3: Sector Preferences */}
      {step === 3 && (
        <Card>
          <Text style={s.wizardTitle}>Sector Preferences</Text>
          <Text style={s.wizardDesc}>Focus on or avoid specific industries?</Text>
          <View style={[s.filterChips, { marginBottom: spacing.md }]}>
            {(['none', 'overweight', 'exclude'] as const).map(m => (
              <TouchableOpacity key={m} style={[s.chip, sectorMode === m && s.chipActive]} onPress={() => {
                setSectorMode(m);
                if (m === 'none') setProfile({ ...profile, sectorPreferences: { ...profile.sectorPreferences, overweight: [], exclude: [] } });
              }}>
                <Text style={[s.chipText, sectorMode === m && s.chipTextActive]}>
                  {m === 'none' ? 'No Preference' : m === 'overweight' ? 'Overweight' : 'Exclude'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {sectorMode !== 'none' && (
            <View style={s.sectorGrid}>
              {SECTORS_LIST.map(sec => {
                const Icon = SECTOR_ICONS[sec] || Cpu;
                const isActive = sectorMode === 'overweight'
                  ? profile.sectorPreferences.overweight.includes(sec)
                  : profile.sectorPreferences.exclude.includes(sec);
                return (
                  <TouchableOpacity key={sec} style={[s.sectorBtn, isActive && (sectorMode === 'overweight' ? s.sectorBtnOverweight : s.sectorBtnExclude)]} onPress={() => toggleSector(sec)} activeOpacity={0.7}>
                    <Icon size={18} color={isActive ? colors.white : colors.slate[500]} strokeWidth={1.8} />
                    <Text style={[s.sectorBtnText, isActive && s.sectorBtnTextActive]} numberOfLines={2}>{sec}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {/* ESG toggle */}
          <View style={s.esgRow}>
            <Leaf size={18} color={profile.sectorPreferences.esgOnly ? colors.primary[600] : colors.slate[400]} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={s.optionLabel}>ESG-Conscious</Text>
              <Text style={s.optionDesc}>Exclude poor ESG companies</Text>
            </View>
            <Switch
              value={profile.sectorPreferences.esgOnly}
              onValueChange={v => setProfile({ ...profile, sectorPreferences: { ...profile.sectorPreferences, esgOnly: v } })}
              trackColor={{ false: colors.slate[200], true: colors.primary[300] }}
              thumbColor={profile.sectorPreferences.esgOnly ? colors.primary[600] : colors.slate[400]}
            />
          </View>
          <View style={s.wizardNav}>
            <Button title="Back" onPress={() => setStep(2)} variant="outline" size="sm" />
            <Button title="Next" onPress={() => setStep(4)} size="sm" icon={<ArrowRight size={14} color={colors.white} strokeWidth={2} />} />
          </View>
        </Card>
      )}

      {/* Step 4: Income/Growth + Concentration */}
      {step === 4 && (
        <Card>
          <Text style={s.wizardTitle}>Style & Concentration</Text>
          <Text style={s.filterTitle}>Income vs Growth</Text>
          <View style={s.sliderRow}>
            <Text style={s.sliderLabel}>Income</Text>
            <View style={s.sliderTrack}>
              {[0, 25, 50, 75, 100].map(val => (
                <TouchableOpacity key={val} style={[s.sliderDot, profile.incomeGrowthSplit === val && s.sliderDotActive]} onPress={() => setProfile({ ...profile, incomeGrowthSplit: val })}>
                  <Text style={[s.sliderDotText, profile.incomeGrowthSplit === val && s.sliderDotTextActive]}>{val}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.sliderLabel}>Growth</Text>
          </View>
          <View style={s.dualColorBar}>
            <View style={[s.dualColorIncome, { flex: 100 - profile.incomeGrowthSplit || 1 }]} />
            <View style={[s.dualColorGrowth, { flex: profile.incomeGrowthSplit || 1 }]} />
          </View>
          <View style={s.dualColorLabels}>
            <Text style={[s.sliderDotText, { color: colors.info[600] }]}>{100 - profile.incomeGrowthSplit}% Income</Text>
            <Text style={[s.sliderDotText, { color: colors.primary[600] }]}>{profile.incomeGrowthSplit}% Growth</Text>
          </View>

          <Text style={[s.filterTitle, { marginTop: spacing.lg }]}>Portfolio Concentration</Text>
          {CONCENTRATIONS.map(c => (
            <TouchableOpacity key={c.value} style={[s.optionRow, profile.concentration === c.value && s.optionRowActive]} onPress={() => setProfile({ ...profile, concentration: c.value })}>
              <View>
                <Text style={s.optionLabel}>{c.label}</Text>
                <Text style={s.optionDesc}>{c.desc}</Text>
              </View>
              {profile.concentration === c.value && <Check size={18} color={colors.primary[600]} strokeWidth={2.5} />}
            </TouchableOpacity>
          ))}
          <View style={s.wizardNav}>
            <Button title="Back" onPress={() => setStep(3)} variant="outline" size="sm" />
            <Button title="Next" onPress={() => setStep(5)} size="sm" icon={<ArrowRight size={14} color={colors.white} strokeWidth={2} />} />
          </View>
        </Card>
      )}

      {/* Step 5: Existing Holdings */}
      {step === 5 && (
        <Card>
          <Text style={s.wizardTitle}>Existing Holdings</Text>
          <Text style={s.wizardDesc}>Do you have stocks you already own?</Text>
          <View style={[s.filterChips, { marginBottom: spacing.md }]}>
            <TouchableOpacity style={[s.chip, holdingsMode === 'fresh' && s.chipActive]} onPress={() => { setHoldingsMode('fresh'); setProfile({ ...profile, existingHoldings: [] }); }}>
              <Text style={[s.chipText, holdingsMode === 'fresh' && s.chipTextActive]}>Start Fresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.chip, holdingsMode === 'existing' && s.chipActive]} onPress={() => setHoldingsMode('existing')}>
              <Text style={[s.chipText, holdingsMode === 'existing' && s.chipTextActive]}>I Have Holdings</Text>
            </TouchableOpacity>
          </View>

          {holdingsMode === 'existing' && (
            <>
              <View style={s.addRow}>
                <TextInput
                  style={s.addInput}
                  placeholder="Enter ticker to add..."
                  placeholderTextColor={colors.slate[400]}
                  value={holdingsSearch}
                  onChangeText={setHoldingsSearch}
                  autoCapitalize="characters"
                />
                <Button title="Add" onPress={() => {
                  const t = holdingsSearch.trim().toUpperCase();
                  if (t && !profile.existingHoldings.includes(t)) {
                    setProfile({ ...profile, existingHoldings: [...profile.existingHoldings, t] });
                    setHoldingsSearch('');
                  }
                }} size="sm" disabled={!holdingsSearch.trim()} />
              </View>
              {profile.existingHoldings.length > 0 && (
                <View style={[s.filterChips, { marginTop: spacing.md }]}>
                  {profile.existingHoldings.map(t => (
                    <TouchableOpacity key={t} style={s.holdingChip} onPress={() => setProfile({ ...profile, existingHoldings: profile.existingHoldings.filter(h => h !== t) })}>
                      <Text style={s.holdingChipText}>{t}</Text>
                      <X size={12} color={colors.slate[500]} strokeWidth={2} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {profile.existingHoldings.length === 0 && (
                <Text style={[s.emptyText, { marginTop: spacing.md }]}>No holdings added yet</Text>
              )}
            </>
          )}

          {holdingsMode === 'fresh' && (
            <View style={s.emptyState}>
              <Briefcase size={32} color={colors.slate[300]} strokeWidth={1.5} />
              <Text style={s.emptyTitle}>Starting with a clean slate</Text>
              <Text style={s.emptyText}>We will build from scratch</Text>
            </View>
          )}

          <View style={s.wizardNav}>
            <Button title="Back" onPress={() => setStep(4)} variant="outline" size="sm" />
            <Button title="Next" onPress={() => setStep(6)} size="sm" icon={<ArrowRight size={14} color={colors.white} strokeWidth={2} />} />
          </View>
        </Card>
      )}

      {/* Step 6: Constraints */}
      {step === 6 && (
        <Card>
          <Text style={s.wizardTitle}>Constraints</Text>
          <Text style={s.wizardDesc}>Optional filters and limits</Text>
          {([
            ['noPennyStocks', 'No Penny Stocks', 'Exclude stocks under $5'],
            ['noOptions', 'Options Available', 'Only stocks with options'],
            ['dividendsOnly', 'Must Pay Dividend', 'Only dividend-paying stocks'],
            ['nyseOnly', 'NYSE Only', 'US exchanges only'],
          ] as const).map(([key, label, desc]) => (
            <TouchableOpacity
              key={key}
              style={[s.optionRow, profile.constraints[key] && s.optionRowActive]}
              onPress={() => setProfile({
                ...profile,
                constraints: { ...profile.constraints, [key]: !profile.constraints[key] },
              })}
            >
              <View>
                <Text style={s.optionLabel}>{label}</Text>
                <Text style={s.optionDesc}>{desc}</Text>
              </View>
              {profile.constraints[key] && <Check size={18} color={colors.primary[600]} strokeWidth={2.5} />}
            </TouchableOpacity>
          ))}

          <Text style={[s.filterTitle, { marginTop: spacing.lg }]}>Market Cap Minimum</Text>
          <View style={s.filterChips}>
            <TouchableOpacity style={[s.chip, !profile.constraints.minMarketCap && s.chipActive]} onPress={() => setProfile({ ...profile, constraints: { ...profile.constraints, minMarketCap: 0 } })}>
              <Text style={[s.chipText, !profile.constraints.minMarketCap && s.chipTextActive]}>Any</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.chip, profile.constraints.minMarketCap === 1000000000 && s.chipActive]} onPress={() => setProfile({ ...profile, constraints: { ...profile.constraints, minMarketCap: 1000000000 } })}>
              <Text style={[s.chipText, profile.constraints.minMarketCap === 1000000000 && s.chipTextActive]}>$1B+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.chip, profile.constraints.minMarketCap === 10000000000 && s.chipActive]} onPress={() => setProfile({ ...profile, constraints: { ...profile.constraints, minMarketCap: 10000000000 } })}>
              <Text style={[s.chipText, profile.constraints.minMarketCap === 10000000000 && s.chipTextActive]}>$10B+</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.filterTitle, { marginTop: spacing.lg }]}>Max Position Size: {profile.constraints.maxPositionPct}%</Text>
          <View style={s.filterChips}>
            {[5, 10, 15, 20, 30, 50].map(v => (
              <TouchableOpacity key={v} style={[s.chip, profile.constraints.maxPositionPct === v && s.chipActive]} onPress={() => setProfile({ ...profile, constraints: { ...profile.constraints, maxPositionPct: v } })}>
                <Text style={[s.chipText, profile.constraints.maxPositionPct === v && s.chipTextActive]}>{v}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.filterTitle, { marginTop: spacing.md }]}>Max Sector Exposure: {profile.constraints.maxSectorPct}%</Text>
          <View style={s.filterChips}>
            {[10, 20, 30, 40, 50].map(v => (
              <TouchableOpacity key={v} style={[s.chip, profile.constraints.maxSectorPct === v && s.chipActive]} onPress={() => setProfile({ ...profile, constraints: { ...profile.constraints, maxSectorPct: v } })}>
                <Text style={[s.chipText, profile.constraints.maxSectorPct === v && s.chipTextActive]}>{v}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.wizardNav}>
            <Button title="Back" onPress={() => setStep(5)} variant="outline" size="sm" />
            <Button title="Next" onPress={() => setStep(7)} size="sm" icon={<ArrowRight size={14} color={colors.white} strokeWidth={2} />} />
          </View>
        </Card>
      )}

      {/* Step 7: Review */}
      {step === 7 && (
        <Card>
          <Text style={s.wizardTitle}>Review & Build</Text>
          <View style={s.reviewGrid}>
            <ReviewItem label="Amount" value={`$${profile.investmentAmount.toLocaleString()}`} onEdit={() => setStep(0)} />
            <ReviewItem label="Horizon" value={HORIZONS.find(h => h.value === profile.horizon)?.label || ''} onEdit={() => setStep(1)} />
            <ReviewItem label="Risk" value={RISK_LEVELS.find(r => r.value === profile.riskTolerance)?.label || ''} onEdit={() => setStep(2)} />
            <ReviewItem label="Sectors" value={
              profile.sectorPreferences.overweight.length > 0 ? `OW: ${profile.sectorPreferences.overweight.join(', ')}`
              : profile.sectorPreferences.exclude.length > 0 ? `Excl: ${profile.sectorPreferences.exclude.join(', ')}`
              : 'No preference'
            } onEdit={() => setStep(3)} />
            <ReviewItem label="Income/Growth" value={`${100 - profile.incomeGrowthSplit}% / ${profile.incomeGrowthSplit}%`} onEdit={() => setStep(4)} />
            <ReviewItem label="Concentration" value={CONCENTRATIONS.find(c => c.value === profile.concentration)?.label || ''} onEdit={() => setStep(4)} />
            <ReviewItem label="Holdings" value={profile.existingHoldings.length > 0 ? profile.existingHoldings.join(', ') : 'Starting fresh'} onEdit={() => setStep(5)} />
            <ReviewItem label="Constraints" value={getConstraintsSummary(profile.constraints)} onEdit={() => setStep(6)} />
          </View>
          <View style={s.wizardNav}>
            <Button title="Back" onPress={() => setStep(6)} variant="outline" size="sm" />
            <Button
              title="Build Portfolio"
              onPress={onSubmit}
              size="sm"
              icon={<Sparkles size={14} color={colors.white} strokeWidth={2} />}
            />
          </View>
        </Card>
      )}
    </>
  );
}

function getConstraintsSummary(c: InvestorProfile['constraints']): string {
  const active: string[] = [];
  if (c.noPennyStocks) active.push('No penny stocks');
  if (c.minMarketCap === 10000000000) active.push('Large caps');
  else if (c.minMarketCap === 1000000000) active.push('Min $1B');
  if (c.dividendsOnly) active.push('Dividends');
  if (c.nyseOnly) active.push('NYSE only');
  active.push(`Max ${c.maxPositionPct}% pos`);
  active.push(`Max ${c.maxSectorPct}% sect`);
  return active.slice(0, 3).join(', ') + (active.length > 3 ? ` +${active.length - 3}` : '');
}

function ReviewItem({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <View style={s.reviewItem}>
      <View style={{ flex: 1 }}>
        <Text style={s.reviewLabel}>{label}</Text>
        <Text style={s.reviewValue} numberOfLines={2}>{value}</Text>
      </View>
      {onEdit && (
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
          <Text style={s.reviewEditBtn}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PORTFOLIO RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════

function PortfolioResultsView({ portfolio, profile, openCompany, showToast, onReset }: {
  portfolio: ConstructedPortfolio;
  profile: InvestorProfile;
  openCompany: (ticker: string) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  onReset: () => void;
}) {
  const [expandedPos, setExpandedPos] = useState<string | null>(null);

  const estDividendYield = portfolio.positions.reduce((sum, p) => {
    return sum + (p.weightPct / 100) * 2; // approximate 2% avg dividend yield
  }, 0);

  return (
    <>
      <Card>
        <View style={s.resultHeader}>
          <Sparkles size={20} color={colors.primary[600]} strokeWidth={2} />
          <Text style={s.sectionTitle}>{portfolio.name}</Text>
        </View>
        <Text style={s.reasoning}>{portfolio.executiveSummary}</Text>
        <View style={s.simSumRow}>
          <View style={s.simSumItem}>
            <Text style={s.simSumLabel}>Invested</Text>
            <Text style={s.simSumValue}>${portfolio.totalInvested.toLocaleString()}</Text>
          </View>
          <View style={s.simSumItem}>
            <Text style={s.simSumLabel}>Score</Text>
            <Text style={s.simSumValue}>{portfolio.portfolioScore.toFixed(0)}</Text>
          </View>
          <View style={s.simSumItem}>
            <Text style={s.simSumLabel}>Cash</Text>
            <Text style={s.simSumValue}>${portfolio.remainingCash.toFixed(0)}</Text>
          </View>
        </View>
        {portfolio.reviewCadence && (
          <Text style={[s.reasoning, { marginTop: spacing.sm }]}>Review: {portfolio.reviewCadence}</Text>
        )}
        <Text style={[s.posSector, { marginTop: spacing.xs }]}>Est. dividend yield: {estDividendYield.toFixed(1)}%</Text>
      </Card>

      {/* Positions */}
      <Card>
        <Text style={s.sectionTitle}>Positions ({portfolio.positions.length})</Text>
        {portfolio.positions.map((pos) => (
          <React.Fragment key={pos.ticker}>
            <TouchableOpacity style={s.posRow} onPress={() => setExpandedPos(expandedPos === pos.ticker ? null : pos.ticker)} activeOpacity={0.7}>
              <View style={s.posLeft}>
                <Text style={s.posTicker}>{pos.ticker}</Text>
                <Text style={s.posName} numberOfLines={1}>{pos.companyName}</Text>
                <Text style={s.posSector}>{pos.sector}</Text>
              </View>
              <View style={s.posRight}>
                <Text style={s.posWeight}>{pos.weightPct.toFixed(1)}%</Text>
                <Text style={s.posAmount}>${pos.allocatedAmount.toFixed(0)}</Text>
                <ScoreRing score={pos.personalizedScore} size={28} />
              </View>
            </TouchableOpacity>
            {expandedPos === pos.ticker && (
              <View style={s.posRationaleBox}>
                <Text style={s.filterTitle}>Rationale</Text>
                <Text style={s.reasoning}>{pos.rationale}</Text>
                <Text style={s.posSector}>{pos.shares} shares @ ${pos.entryPrice.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => openCompany(pos.ticker)} style={[s.simViewDetail, { marginTop: spacing.sm }]} activeOpacity={0.7}>
                  <Eye size={14} color={colors.primary[600]} strokeWidth={2} />
                  <Text style={s.simActionText}>Deep Dive</Text>
                </TouchableOpacity>
              </View>
            )}
          </React.Fragment>
        ))}
      </Card>

      {/* Sector allocation */}
      {portfolio.sectorAllocation.length > 0 && (
        <Card>
          <Text style={s.sectionTitle}>Sector Allocation</Text>
          {portfolio.sectorAllocation.map(sa => (
            <View key={sa.sector} style={s.sectorRow}>
              <Text style={s.sectorName}>{sa.sector}</Text>
              <View style={s.sectorBarBg}>
                <View style={[s.sectorBarFill, { width: `${Math.min(sa.pct, 100)}%` }]} />
              </View>
              <Text style={s.sectorPct}>{sa.pct.toFixed(0)}%</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Key risks */}
      {portfolio.keyRisks?.length > 0 && (
        <Card style={{ borderColor: colors.warning[200], borderWidth: 1 }}>
          <View style={s.gateHeader}>
            <AlertTriangle size={16} color={colors.warning[600]} strokeWidth={2} />
            <Text style={[s.sectionTitle, { color: colors.warning[700] }]}>Key Risks</Text>
          </View>
          {portfolio.keyRisks.map((risk, i) => (
            <Text key={i} style={s.riskItem}>{'\u2022'} {risk}</Text>
          ))}
        </Card>
      )}

      {/* Actions */}
      <View style={s.companyActions}>
        <Button title="Build New Portfolio" onPress={onReset} variant="outline" fullWidth />
        <Button
          title="Add All to Simulator"
          onPress={async () => {
            try {
              for (const pos of portfolio.positions) {
                await addSimulatorPick(pos.ticker, 'invest_for_me');
              }
              showToast('All positions added to simulator', 'success');
            } catch (err: any) { showToast(err?.message || 'Failed', 'error'); }
          }}
          icon={<Target size={16} color={colors.white} strokeWidth={2} />}
          fullWidth
        />
      </View>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPANY DETAIL MODAL (with tabbed navigation)
// ═══════════════════════════════════════════════════════════════════

function CompanyDetailModal({ visible, ticker, data, loading, onClose, showToast, openCompany }: {
  visible: boolean;
  ticker: string | null;
  data: CIRAScore | null;
  loading: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  openCompany: (ticker: string) => void;
}) {
  const [companyTab, setCompanyTab] = useState<CompanyTab>('scores');
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());
  const [tickerHistoryData, setTickerHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newsEvents, setNewsEvents] = useState<any[]>([]);
  const [rerunning, setRerunning] = useState(false);
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastHorizon, setForecastHorizon] = useState<string>('3M');

  // Reset tab when modal opens
  useEffect(() => {
    if (visible) {
      setCompanyTab('scores');
      setExpandedDimensions(new Set());
      setTickerHistoryData([]);
      setNewsEvents([]);
      setForecastData(null);
    }
  }, [visible, ticker]);

  // Build events when data changes
  useEffect(() => {
    if (!data) return;
    const events: any[] = [];
    const dimMap = new Map(data.dimensions.map(d => [d.key, d]));

    const d08 = dimMap.get('d08_catalysts')?.raw_data;
    if (d08?.recommendationKey) {
      events.push({ type: 'analyst', headline: `Analyst consensus: ${d08.recommendationKey.toUpperCase()} \u2014 ${d08.numAnalysts || 0} analysts, target $${Number(d08.targetMeanPrice || 0).toFixed(0)}`, impact: 'high' });
    }
    const d01 = dimMap.get('d01_earnings')?.raw_data;
    if (d01?.fhSurprisePct != null) {
      const sp = Number(d01.fhSurprisePct);
      events.push({ type: 'earnings', headline: `EPS ${sp > 0 ? 'beat' : 'miss'}: ${sp > 0 ? '+' : ''}${sp.toFixed(1)}%`, impact: Math.abs(sp) > 5 ? 'high' : 'medium' });
    }
    if (d01?.earningsGrowth != null) {
      const g = Number(d01.earningsGrowth) * 100;
      events.push({ type: 'earnings', headline: `Earnings growth: ${g > 0 ? '+' : ''}${g.toFixed(0)}%`, impact: Math.abs(g) > 15 ? 'high' : 'low' });
    }
    const d11 = dimMap.get('d11_management')?.raw_data;
    if (d11?.fhInsiderMSPR != null) {
      const mspr = Number(d11.fhInsiderMSPR);
      events.push({ type: 'insider', headline: `Insider MSPR: ${mspr > 0 ? '+' : ''}${mspr.toFixed(0)} (${mspr > 10 ? 'net buying' : mspr < -10 ? 'net selling' : 'balanced'})`, impact: Math.abs(mspr) > 30 ? 'high' : 'low' });
    }
    const d13 = dimMap.get('d13_sentiment')?.raw_data;
    if (d13?.shortPctNormalized != null) {
      const sp = Number(d13.shortPctNormalized);
      events.push({ type: 'sentiment', headline: `Short interest: ${sp.toFixed(1)}% of float`, impact: sp > 10 ? 'high' : 'low' });
    }
    if (d13?.fearGreedIndex != null) {
      const fg = Number(d13.fearGreedIndex);
      events.push({ type: 'sentiment', headline: `Fear & Greed: ${fg.toFixed(0)} (${fg < 25 ? 'Extreme Fear' : fg > 75 ? 'Extreme Greed' : 'Neutral'})`, impact: fg < 25 || fg > 80 ? 'high' : 'low' });
    }
    const d15 = dimMap.get('d15_risk')?.raw_data;
    if (d15?.altmanZProxy != null) {
      const z = Number(d15.altmanZProxy);
      events.push({ type: 'risk', headline: `Altman Z: ${z.toFixed(2)} (${z > 2.99 ? 'safe' : z > 1.81 ? 'grey' : 'distress'})`, impact: z < 1.81 ? 'high' : 'low' });
    }

    events.sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.impact] ?? 2) - (order[b.impact] ?? 2);
    });
    setNewsEvents(events);
  }, [data]);

  const loadHistory = async () => {
    if (!ticker || tickerHistoryData.length > 0) return;
    setHistoryLoading(true);
    try {
      const result = await getTickerHistory(ticker, 20);
      setTickerHistoryData(result.history || []);
    } catch { /* skip */ }
    setHistoryLoading(false);
  };

  const loadForecast = async (horizon: string) => {
    if (!ticker) return;
    setForecastLoading(true);
    setForecastHorizon(horizon);
    try {
      const result = await getForecast(ticker, horizon);
      console.log('[Forecast API response]', JSON.stringify(result).slice(0, 500));
      setForecastData(result);
    } catch (err) { console.log('[Forecast error]', err); }
    setForecastLoading(false);
  };

  const handleRerun = async () => {
    if (!ticker) return;
    setRerunning(true);
    try {
      const result = await scoreStock(ticker);
      // This will cause parent to update companyData via openCompany
      openCompany(ticker);
    } catch (err: any) {
      showToast(err?.message || 'Failed to re-run', 'error');
    }
    setRerunning(false);
  };

  const toggleDimension = (key: string) => {
    const newExpanded = new Set(expandedDimensions);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpandedDimensions(newExpanded);
  };

  const getTierNum = (key: string) => {
    const num = parseInt(key.slice(1, 3));
    return num <= 5 ? 1 : num <= 10 ? 2 : 3;
  };

  const getTierColor = (tier: number) => tier === 1 ? '#D4A843' : tier === 2 ? '#C0C0C0' : '#CD7F32';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modalSafe}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.modalClose} activeOpacity={0.7}>
            <X size={20} color={colors.slate[600]} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={s.modalTitle}>{ticker}</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? <LoadingSpinner fullScreen /> : data ? (
          <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Company header */}
            <View style={s.companyHeader}>
              <ScoreRing score={data.final_score} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={s.companyName}>{data.company_name}</Text>
                <Text style={s.companySector}>{data.sector} {data.market_cycle_stage ? `\u00B7 ${data.market_cycle_stage.replace('_', ' ')}` : ''}</Text>
                <View style={s.companyMeta}>
                  <ConvictionBadge conviction={data.conviction} />
                  <Text style={s.companyPrice}>${data.current_price.toFixed(2)}</Text>
                  {data.intrinsic_value_estimate && (
                    <Text style={s.posSector}>IV: ${data.intrinsic_value_estimate.toFixed(0)}</Text>
                  )}
                </View>
                {/* Per-horizon verdicts */}
                {data.conviction_detail?.horizons && (
                  <View style={[s.filterChips, { marginTop: spacing.sm }]}>
                    {data.conviction_detail.horizons.map(h => (
                      <View key={h.horizon} style={s.horizonCard}>
                        <ConvictionBadge conviction={h.verdict} />
                        <Text style={s.horizonScore}>{h.horizon === 'short' ? '1-3mo' : h.horizon === 'medium' ? '3-12mo' : '1-5yr'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* AI Thesis */}
            {data.llm_thesis && (
              <Card>
                <View style={s.thesisHeader}>
                  <Sparkles size={16} color={colors.primary[600]} strokeWidth={2} />
                  <Text style={s.sectionTitle}>AI Thesis</Text>
                </View>
                <Text style={s.reasoning}>{data.llm_thesis}</Text>
              </Card>
            )}

            {/* Tab bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={s.companyTabBar}>
                {([
                  { key: 'scores' as const, label: 'Scores' },
                  { key: 'gates' as const, label: 'Gates' },
                  { key: 'forecast' as const, label: 'Forecast' },
                  { key: 'events' as const, label: 'Events' },
                  { key: 'history' as const, label: 'History' },
                ]).map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[s.companyTabBtn, companyTab === tab.key && s.companyTabBtnActive]}
                    onPress={() => {
                      setCompanyTab(tab.key);
                      if (tab.key === 'history') loadHistory();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.companyTabText, companyTab === tab.key && s.companyTabTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Scores tab */}
            {companyTab === 'scores' && (
              <>
                <Card>
                  <Text style={s.sectionTitle}>Score Breakdown</Text>
                  <View style={s.scoreGrid}>
                    <ScoreGridItem label="Raw Composite" value={data.raw_composite} />
                    <ScoreGridItem label="Cycle Adjusted" value={data.cycle_adjusted} />
                    <ScoreGridItem label="Final Score" value={data.final_score} />
                    {data.margin_of_safety_pct != null && (
                      <ScoreGridItem label="Margin of Safety" value={data.margin_of_safety_pct} suffix="%" isPercent />
                    )}
                  </View>
                </Card>

                {data.conviction_detail && (
                  <Card>
                    <Text style={s.sectionTitle}>Conviction Analysis</Text>
                    <Text style={s.reasoning}>{data.conviction_detail.reasoning}</Text>
                  </Card>
                )}

                <Card>
                  <Text style={s.sectionTitle}>Dimensions ({data.dimensions.length})</Text>
                  {data.dimensions.sort((a, b) => b.weighted_score - a.weighted_score).map(dim => {
                    const tier = getTierNum(dim.key);
                    const isExpanded = expandedDimensions.has(dim.key);
                    return (
                      <View key={dim.key}>
                        <TouchableOpacity style={s.dimRow} onPress={() => toggleDimension(dim.key)} activeOpacity={0.7}>
                          <View style={s.dimInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                              <Text style={s.dimName}>{dim.name}</Text>
                              <View style={[s.tierBadge, { backgroundColor: getTierColor(tier) }]}>
                                <Text style={s.tierBadgeText}>L{tier}</Text>
                              </View>
                            </View>
                            <Text style={s.dimWeight}>Weight: {(dim.weight * 100).toFixed(0)}% \u00B7 Weighted: {dim.weighted_score.toFixed(2)}</Text>
                          </View>
                          <ScoreRing score={dim.score} size={32} />
                          {isExpanded ? <ChevronUp size={14} color={colors.slate[400]} /> : <ChevronDown size={14} color={colors.slate[400]} />}
                        </TouchableOpacity>
                        {isExpanded && (
                          <View style={s.dimExpanded}>
                            <Text style={s.filterTitle}>Reasoning</Text>
                            <Text style={s.reasoning}>{dim.reasoning}</Text>
                            {Object.keys(dim.raw_data).length > 0 && (
                              <>
                                <Text style={[s.filterTitle, { marginTop: spacing.sm }]}>Evidence Data</Text>
                                {Object.entries(dim.raw_data).filter(([_, v]) => v != null && typeof v !== 'object' && v !== '').slice(0, 10).map(([k, v]) => (
                                  <View key={k} style={s.rawDataRow}>
                                    <Text style={s.rawDataKey}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/_/g, ' ')}</Text>
                                    <Text style={s.rawDataValue}>{typeof v === 'number' ? v.toFixed(4) : String(v)}</Text>
                                  </View>
                                ))}
                              </>
                            )}
                            {dim.data_sources.length > 0 && (
                              <>
                                <Text style={[s.filterTitle, { marginTop: spacing.sm }]}>Sources</Text>
                                <View style={s.filterChips}>
                                  {dim.data_sources.map((src, i) => (
                                    <View key={i} style={s.sourceBadge}>
                                      <Text style={s.sourceBadgeText}>{src}</Text>
                                    </View>
                                  ))}
                                </View>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {/* Gates tab */}
            {companyTab === 'gates' && (
              <>
                <Card>
                  <Text style={s.sectionTitle}>Safety Checks</Text>
                  <Text style={s.reasoning}>
                    Before giving a final rating, CIRA v2 runs safety checks.
                    {data.gates.filter(g => g.triggered).length === 0 ? ' All checks passed.' : ` ${data.gates.filter(g => g.triggered).length} check(s) flagged concerns.`}
                  </Text>

                  {/* Score flow */}
                  <View style={s.scoreFlowRow}>
                    <View style={s.scoreFlowItem}>
                      <Text style={s.posSector}>Before</Text>
                      <Text style={s.simSumValue}>{Math.round(data.raw_composite)}</Text>
                    </View>
                    <ArrowRight size={16} color={colors.slate[400]} strokeWidth={2} />
                    <View style={s.scoreFlowItem}>
                      <Text style={s.posSector}>After</Text>
                      <Text style={[s.simSumValue, { fontSize: typography.fontSize.xl }]}>{Math.round(data.final_score)}</Text>
                    </View>
                  </View>
                </Card>

                {data.gates.map((gate, idx) => (
                  <Card key={idx} style={{ borderWidth: 1, borderColor: gate.triggered ? colors.error[200] : colors.success[200] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                      <Text style={s.optionLabel}>{gate.name}</Text>
                      <View style={[s.gateStatusBadge, { backgroundColor: gate.triggered ? colors.error[100] : colors.success[100] }]}>
                        <Text style={[s.gateStatusText, { color: gate.triggered ? colors.error[700] : colors.success[700] }]}>
                          {gate.triggered ? 'FLAGGED' : 'CLEAR'}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.reasoning}><Text style={{ fontWeight: '600' }}>Checked:</Text> {gate.value}</Text>
                    <Text style={[s.reasoning, { marginTop: spacing.xs }]}><Text style={{ fontWeight: '600' }}>Result:</Text> {gate.effect}</Text>
                  </Card>
                ))}
              </>
            )}

            {/* Forecast tab */}
            {companyTab === 'forecast' && (
              <ForecastTab
                ticker={data.ticker}
                forecastData={forecastData}
                forecastLoading={forecastLoading}
                forecastHorizon={forecastHorizon}
                loadForecast={loadForecast}
                llmForecast={data.llm_forecast}
              />
            )}

            {/* Events tab */}
            {companyTab === 'events' && (
              <>
                {newsEvents.length === 0 ? (
                  <EmptyState icon={Bell} title="No events" text="Event data not available" />
                ) : (
                  <View style={s.stockList}>
                    {newsEvents.map((evt, idx) => (
                      <Card key={idx}>
                        <View style={s.alertRow}>
                          <View style={[s.alertDot, {
                            backgroundColor: evt.impact === 'high' ? colors.error[500] : evt.impact === 'medium' ? colors.warning[500] : colors.slate[300]
                          }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.alertTitle}>{evt.headline}</Text>
                            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                              <Badge label={evt.type} variant="info" />
                              <Badge label={evt.impact} variant={evt.impact === 'high' ? 'error' : evt.impact === 'medium' ? 'warning' : 'default'} />
                            </View>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* History tab */}
            {companyTab === 'history' && (
              <>
                {historyLoading ? <LoadingSpinner /> : tickerHistoryData.length === 0 ? (
                  <EmptyState icon={Clock} title="No history" text="Score history will appear after multiple analyses" />
                ) : (
                  <View style={s.stockList}>
                    {tickerHistoryData.map((entry: any, idx: number) => {
                      const prev = tickerHistoryData[idx + 1];
                      const scoreDelta = prev ? (Number(entry.current_score) - Number(prev.current_score)) : 0;
                      return (
                        <Card key={idx}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                              <Text style={s.optionLabel}>Score: {Math.round(Number(entry.current_score))}</Text>
                              <Text style={s.posSector}>{entry.current_conviction} \u00B7 ${Number(entry.current_price).toFixed(2)}</Text>
                              <Text style={s.posSector}>{entry.created_at?.slice(0, 10)}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <ScoreRing score={Number(entry.current_score)} size={32} />
                              {scoreDelta !== 0 && (
                                <Text style={[s.posSector, { color: scoreDelta > 0 ? colors.primary[600] : colors.error[600] }]}>
                                  {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(0)}
                                </Text>
                              )}
                            </View>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* Actions */}
            <View style={s.companyActions}>
              <Button
                title={rerunning ? 'Re-running...' : 'Re-run Analysis'}
                onPress={handleRerun}
                disabled={rerunning}
                icon={<RefreshCw size={16} color={colors.white} strokeWidth={2} />}
                fullWidth
              />
              <Button
                title="Add to Simulator"
                onPress={async () => {
                  try { await addSimulatorPick(data.ticker); showToast(`Added ${data.ticker} to simulator`, 'success'); }
                  catch (err: any) { showToast(err?.message || 'Failed', 'error'); }
                }}
                icon={<Target size={16} color={colors.white} strokeWidth={2} />}
                fullWidth
              />
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FORECAST TAB + CHART
// ═══════════════════════════════════════════════════════════════════

function ForecastChart({ historical, forecast }: { historical: any[]; forecast: any[] }) {
  const W = Dimensions.get('window').width - 64;
  const H = 180;
  const PAD = { top: 10, bottom: 25, left: 45, right: 10 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const histPts = (historical || []).map((p: any) => ({ price: Number(p.close || p.price || 0), date: p.date }));
  const fcPts = (forecast || []).map((p: any) => ({ target: Number(p.target || p.price || 0), upper: Number(p.upper || p.target || p.price || 0), lower: Number(p.lower || p.target || p.price || 0), date: p.date }));

  if (histPts.length === 0 && fcPts.length === 0) return null;

  const allPrices = [...histPts.map((p: any) => p.price), ...fcPts.map((p: any) => p.upper), ...fcPts.map((p: any) => p.lower)].filter(Boolean);
  const minP = Math.min(...allPrices) * 0.97;
  const maxP = Math.max(...allPrices) * 1.03;
  const totalPts = histPts.length + fcPts.length;
  const xScale = (i: number) => PAD.left + (i / Math.max(totalPts - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - ((v - minP) / (maxP - minP || 1)) * chartH;

  // Historical line
  let histPath = '';
  histPts.forEach((p: any, i: number) => { histPath += `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.price).toFixed(1)}`; });

  // Forecast line + band
  const fcStart = histPts.length;
  let fcPath = histPts.length > 0 ? `M${xScale(fcStart - 1).toFixed(1)},${yScale(histPts[histPts.length - 1].price).toFixed(1)}` : '';
  let bandPath = '';
  if (fcPts.length > 0) {
    // Upper line forward
    bandPath = `M${xScale(fcStart).toFixed(1)},${yScale(fcPts[0].upper).toFixed(1)}`;
    fcPts.forEach((p: any, i: number) => {
      const x = xScale(fcStart + i);
      fcPath += `L${x.toFixed(1)},${yScale(p.target).toFixed(1)}`;
      bandPath += `L${x.toFixed(1)},${yScale(p.upper).toFixed(1)}`;
    });
    // Lower line backward
    for (let i = fcPts.length - 1; i >= 0; i--) {
      bandPath += `L${xScale(fcStart + i).toFixed(1)},${yScale(fcPts[i].lower).toFixed(1)}`;
    }
    bandPath += 'Z';
  }

  // Y-axis labels
  const yLabels = [minP, minP + (maxP - minP) / 2, maxP].map(v => ({ v, y: yScale(v) }));

  // X-axis labels
  const allDates = [...histPts.map((p: any) => p.date), ...fcPts.map((p: any) => p.date)];
  const xLabels = [0, Math.floor(totalPts / 2), totalPts - 1].filter(i => i < allDates.length).map(i => ({
    x: xScale(i), label: allDates[i] ? new Date(allDates[i]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
  }));

  // Today line
  const todayX = histPts.length > 0 ? xScale(histPts.length - 1) : 0;

  return (
    <Svg width={W} height={H}>
      {/* Y grid + labels */}
      {yLabels.map((l, i) => (
        <React.Fragment key={i}>
          <Line x1={PAD.left} y1={l.y} x2={W - PAD.right} y2={l.y} stroke={colors.slate[200]} strokeWidth={0.5} />
          <SvgText x={PAD.left - 4} y={l.y + 4} fontSize={10} fill={colors.slate[400]} textAnchor="end">${l.v.toFixed(0)}</SvgText>
        </React.Fragment>
      ))}
      {/* X labels */}
      {xLabels.map((l, i) => (
        <SvgText key={i} x={l.x} y={H - 4} fontSize={9} fill={colors.slate[400]} textAnchor="middle">{l.label}</SvgText>
      ))}
      {/* Confidence band */}
      {bandPath ? <Path d={bandPath} fill={colors.primary[100]} opacity={0.4} /> : null}
      {/* Today line */}
      {todayX > 0 && <Line x1={todayX} y1={PAD.top} x2={todayX} y2={PAD.top + chartH} stroke={colors.slate[300]} strokeWidth={1} strokeDasharray="4,3" />}
      {todayX > 0 && <SvgText x={todayX} y={PAD.top - 2} fontSize={9} fill={colors.slate[400]} textAnchor="middle">Today</SvgText>}
      {/* Historical line */}
      {histPath ? <Path d={histPath} fill="none" stroke={colors.slate[900]} strokeWidth={2} /> : null}
      {/* Forecast line */}
      {fcPath ? <Path d={fcPath} fill="none" stroke={colors.primary[600]} strokeWidth={2} strokeDasharray="5,3" /> : null}
    </Svg>
  );
}

function ForecastTab({ ticker, forecastData, forecastLoading, forecastHorizon, loadForecast, llmForecast }: {
  ticker: string;
  forecastData: any;
  forecastLoading: boolean;
  forecastHorizon: string;
  loadForecast: (h: string) => void;
  llmForecast?: { bull: string; base: string; bear: string };
}) {
  useEffect(() => { if (!forecastData && !forecastLoading) loadForecast(forecastHorizon); }, []);

  const fc = forecastData || {};
  const currentPrice = Number(fc.current_price || fc.currentPrice || 0);
  const targetPrice = Number(fc.consensus_target || fc.target_price || fc.consensusTarget || 0);
  const projReturn = Number(fc.projected_return || fc.projectedReturn || 0);
  const aiBias = fc.ai_bias || fc.aiBias || '';
  const histPrices = fc.historical_prices || fc.historicalPrices || fc.history || [];
  const fcPoints = fc.forecast_points || fc.forecastPoints || fc.points || [];
  const scenarios = fc.scenarios || {};

  return (
    <>
      {/* Horizon selector */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.md }}>
        {['1M', '3M', '6M', '1Y'].map(h => (
          <TouchableOpacity
            key={h}
            onPress={() => loadForecast(h)}
            style={{
              paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
              borderRadius: borderRadius.lg,
              backgroundColor: forecastHorizon === h ? colors.primary[600] : colors.slate[100],
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold as any, color: forecastHorizon === h ? colors.white : colors.slate[600] }}>{h}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {forecastLoading ? <LoadingSpinner /> : forecastData ? (
        <>
          {/* Summary stats */}
          <Card>
            <Text style={s.sectionTitle}>Price Forecast & Projection</Text>
            {fc.generated_at && (
              <Text style={[s.posSector, { marginBottom: spacing.md }]}>
                Generated {new Date(fc.generated_at).toLocaleDateString()}
              </Text>
            )}
            <View style={s.simSumRow}>
              <View style={s.simSumItem}>
                <Text style={s.simSumLabel}>Current</Text>
                <Text style={s.simSumValue}>${currentPrice.toFixed(2)}</Text>
              </View>
              <View style={s.simSumItem}>
                <Text style={s.simSumLabel}>Target</Text>
                <Text style={[s.simSumValue, { color: colors.primary[600] }]}>${targetPrice.toFixed(2)}</Text>
              </View>
              <View style={s.simSumItem}>
                <Text style={s.simSumLabel}>Return</Text>
                <Text style={[s.simSumValue, { color: projReturn >= 0 ? colors.primary[600] : colors.error[600] }]}>
                  {projReturn >= 0 ? '+' : ''}{projReturn.toFixed(1)}%
                </Text>
              </View>
            </View>
            {aiBias ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
                <TrendingUp size={14} color={aiBias === 'Bullish' ? colors.primary[600] : aiBias === 'Bearish' ? colors.error[600] : colors.slate[500]} strokeWidth={2} />
                <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold as any, color: aiBias === 'Bullish' ? colors.primary[600] : aiBias === 'Bearish' ? colors.error[600] : colors.slate[600] }}>
                  AI Bias: {aiBias}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Chart */}
          {(histPrices.length > 0 || fcPoints.length > 0) && (
            <Card>
              <ForecastChart historical={histPrices} forecast={fcPoints} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 16, height: 2, backgroundColor: colors.slate[900] }} />
                  <Text style={{ fontSize: typography.fontSize.xs, color: colors.slate[500] }}>Historical</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 16, height: 2, backgroundColor: colors.primary[600], borderStyle: 'dashed' }} />
                  <Text style={{ fontSize: typography.fontSize.xs, color: colors.slate[500] }}>Forecast</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 12, height: 8, backgroundColor: colors.primary[100], opacity: 0.6, borderRadius: 2 }} />
                  <Text style={{ fontSize: typography.fontSize.xs, color: colors.slate[500] }}>85% Band</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Scenario Analysis */}
          {(scenarios.bull || scenarios.base || scenarios.bear || llmForecast) && (
            <Card>
              <Text style={s.sectionTitle}>Scenario Analysis</Text>
              <View style={s.forecastGrid}>
                <ForecastItem label="Bull Case" text={scenarios.bull || llmForecast?.bull || 'N/A'} color={colors.primary[600]} />
                <ForecastItem label="Base Case" text={scenarios.base || llmForecast?.base || 'N/A'} color={colors.slate[600]} />
                <ForecastItem label="Bear Case" text={scenarios.bear || llmForecast?.bear || 'N/A'} color={colors.error[600]} />
              </View>
            </Card>
          )}
        </>
      ) : (
        <EmptyState icon={TrendingUp} title="No forecast available" text="Forecast data will appear after analysis" />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPER SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <Card>
      <View style={s.emptyState}>
        <Icon size={32} color={colors.slate[300]} strokeWidth={1.5} />
        <Text style={s.emptyTitle}>{title}</Text>
        <Text style={s.emptyText}>{text}</Text>
      </View>
    </Card>
  );
}

function ScoreGridItem({ label, value, suffix = '', isPercent = false }: { label: string; value: number; suffix?: string; isPercent?: boolean }) {
  const color = isPercent
    ? (value >= 0 ? colors.primary[600] : colors.error[600])
    : (value >= 70 ? colors.primary[600] : value >= 40 ? '#d97706' : colors.error[600]);
  return (
    <View style={s.scoreItem}>
      <Text style={s.scoreItemLabel}>{label}</Text>
      <Text style={[s.scoreItemValue, { color }]}>{isPercent && value >= 0 ? '+' : ''}{value.toFixed(1)}{suffix}</Text>
    </View>
  );
}

function ForecastItem({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <View style={s.forecastItem}>
      <Text style={[s.forecastLabel, { color }]}>{label}</Text>
      <Text style={s.forecastText}>{text}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pageTitle: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.slate[900] },
  pageSubtitle: { fontSize: typography.fontSize.sm, color: colors.slate[500], marginTop: 2 },

  // Tab bar
  tabBarScroll: { flexGrow: 0, backgroundColor: colors.slate[50], paddingBottom: spacing.sm, zIndex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.slate[100], borderRadius: borderRadius.lg, padding: 3, marginHorizontal: spacing.lg },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: borderRadius.md },
  tabActive: { backgroundColor: colors.white, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabLabel: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.slate[400] },
  tabLabelActive: { color: colors.primary[700], fontWeight: typography.fontWeight.semibold },

  // Search
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate[200], borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, height: 44 },
  searchText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.slate[900] },
  filterBtn: { width: 44, height: 44, borderRadius: borderRadius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate[200], alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { fontSize: 10, fontWeight: typography.fontWeight.bold, color: colors.white },

  // Filters
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  clearFiltersText: { fontSize: typography.fontSize.xs, color: colors.primary[600], fontWeight: typography.fontWeight.semibold },
  filterTitle: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.slate[500], marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.slate[100], borderWidth: 1, borderColor: colors.slate[200] },
  chipActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[300] },
  chipText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.slate[600] },
  chipTextActive: { color: colors.primary[700], fontWeight: typography.fontWeight.semibold },

  scoreRangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreRangeInput: { flex: 1, height: 36, borderWidth: 1, borderColor: colors.slate[200], borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, fontSize: typography.fontSize.sm, color: colors.slate[900], textAlign: 'center', backgroundColor: colors.white },
  scoreRangeSeparator: { fontSize: typography.fontSize.xs, color: colors.slate[400] },

  statsBar: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', flexWrap: 'wrap' },
  statsText: { fontSize: typography.fontSize.xs, color: colors.slate[500], fontWeight: typography.fontWeight.medium },
  statsTextHighlight: { fontSize: typography.fontSize.xs, color: colors.primary[700], fontWeight: typography.fontWeight.bold },

  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  distCount: { fontSize: 10, fontWeight: typography.fontWeight.semibold, color: colors.slate[500], textAlign: 'center', marginTop: 2 },
  totalCount: { fontSize: typography.fontSize.xs, color: colors.slate[400], marginLeft: 'auto' },

  stockList: { gap: spacing.sm },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.sm },
  emptyTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.slate[500] },
  emptyText: { fontSize: typography.fontSize.sm, color: colors.slate[400], textAlign: 'center', maxWidth: 260 },

  // Sim summary
  simSummary: { gap: spacing.md },
  simSumRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  simSumItem: { flex: 1, alignItems: 'center' },
  simSumLabel: { fontSize: typography.fontSize.xs, color: colors.slate[500], marginBottom: 2 },
  simSumValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.slate[900] },

  sectionTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[700], marginBottom: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addInput: { flex: 1, height: 40, backgroundColor: colors.slate[50], borderWidth: 1, borderColor: colors.slate[200], borderRadius: borderRadius.md, paddingHorizontal: spacing.md, fontSize: typography.fontSize.sm, color: colors.slate[900] },
  simActions: { flexDirection: 'row', gap: spacing.sm },
  simActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: borderRadius.md, backgroundColor: colors.primary[50], borderWidth: 1, borderColor: colors.primary[200] },
  simActionText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.primary[700] },

  // Simulator grouped
  simGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  simGroupExpanded: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.slate[100], marginTop: spacing.md },
  simEntryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  simEntryText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.slate[800] },
  simEntryClose: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.error[50], alignItems: 'center', justifyContent: 'center' },
  simViewDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  thesisBox: { backgroundColor: colors.slate[50], borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm },

  // Sub-tab bar (portfolio)
  subTabBar: { flexDirection: 'row', backgroundColor: colors.slate[100], borderRadius: borderRadius.md, padding: 2 },
  subTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: borderRadius.sm },
  subTabActive: { backgroundColor: colors.white, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  subTabText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.slate[400] },
  subTabTextActive: { color: colors.primary[700], fontWeight: typography.fontWeight.semibold },

  addStockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.primary[50], borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.primary[200] },
  addStockBtnText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[700] },

  // Alerts
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  alertTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[800] },
  alertMsg: { fontSize: typography.fontSize.xs, color: colors.slate[500], marginTop: 2 },
  alertTicker: { fontSize: typography.fontSize.xs, color: colors.primary[600], fontWeight: typography.fontWeight.semibold, marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.slate[100], marginHorizontal: spacing.lg },

  // Backtest
  btRunningBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.info[50], borderRadius: borderRadius.md },
  btRunningText: { fontSize: typography.fontSize.xs, color: colors.info[700] },
  btBenchmark: { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.slate[50], borderRadius: borderRadius.md },
  btBenchmarkText: { fontSize: typography.fontSize.xs, color: colors.slate[600], fontWeight: typography.fontWeight.medium },
  btRunRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, gap: spacing.md },
  btRunInfo: { flex: 1 },
  btRunName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[800] },
  btRunDate: { fontSize: typography.fontSize.xs, color: colors.slate[500], marginTop: 2 },
  universeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: colors.slate[100], borderRadius: borderRadius.sm },
  universeBadgeText: { fontSize: 10, fontWeight: typography.fontWeight.semibold, color: colors.slate[600] },

  // IC
  icRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  icName: { fontSize: 10, color: colors.slate[600], width: 80 },
  icBarBg: { flex: 1, height: 8, backgroundColor: colors.slate[100], borderRadius: 4, overflow: 'hidden', position: 'relative' },
  icBarFill: { position: 'absolute', top: 0, height: '100%', borderRadius: 4 },
  icValue: { fontSize: 10, fontWeight: typography.fontWeight.bold, width: 48, textAlign: 'right' },

  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.slate[50] },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate[200], backgroundColor: colors.white },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.slate[100], alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.slate[900] },
  modalScroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },

  // Company detail
  companyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  companyName: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.slate[900] },
  companySector: { fontSize: typography.fontSize.sm, color: colors.slate[500], marginTop: 2 },
  companyMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6, flexWrap: 'wrap' },
  companyPrice: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.slate[800] },

  // Company tabs
  companyTabBar: { flexDirection: 'row', gap: 4, backgroundColor: colors.slate[100], borderRadius: borderRadius.md, padding: 3 },
  companyTabBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: borderRadius.sm },
  companyTabBtnActive: { backgroundColor: colors.white, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  companyTabText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.slate[400] },
  companyTabTextActive: { color: colors.primary[700], fontWeight: typography.fontWeight.semibold },

  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  scoreItem: { width: '45%' as any },
  scoreItemLabel: { fontSize: typography.fontSize.xs, color: colors.slate[500], marginBottom: 2 },
  scoreItemValue: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },

  reasoning: { fontSize: typography.fontSize.sm, color: colors.slate[600], lineHeight: 22 },
  horizonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  horizonCard: { backgroundColor: colors.slate[50], borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', gap: 4, minWidth: 70 },
  horizonLabel: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.slate[600] },
  horizonScore: { fontSize: 10, color: colors.slate[400] },

  thesisHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  forecastGrid: { gap: spacing.md },
  forecastItem: { gap: 4 },
  forecastLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  forecastText: { fontSize: typography.fontSize.sm, color: colors.slate[600], lineHeight: 20 },

  dimRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate[100], gap: spacing.sm },
  dimInfo: { flex: 1 },
  dimName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.slate[800] },
  dimWeight: { fontSize: typography.fontSize.xs, color: colors.slate[400], marginTop: 2 },
  dimExpanded: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.slate[50], borderRadius: borderRadius.md, marginBottom: spacing.sm },
  tierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  tierBadgeText: { fontSize: 9, fontWeight: typography.fontWeight.bold, color: colors.white },

  rawDataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rawDataKey: { fontSize: 10, color: colors.slate[500], flex: 1 },
  rawDataValue: { fontSize: 10, fontWeight: typography.fontWeight.semibold, color: colors.slate[800] },
  sourceBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: colors.info[50], borderRadius: borderRadius.sm },
  sourceBadgeText: { fontSize: 10, color: colors.info[700], fontWeight: typography.fontWeight.medium },

  gateHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  gateRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.warning[100] },
  gateName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.warning[700] },
  gateEffect: { fontSize: typography.fontSize.xs, color: colors.warning[600], marginTop: 2 },
  gateStatusBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: borderRadius.full },
  gateStatusText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },

  scoreFlowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.slate[50], borderRadius: borderRadius.md },
  scoreFlowItem: { alignItems: 'center' },

  companyActions: { gap: spacing.sm },

  // Invest wizard
  wizardProgress: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.slate[200] },
  progressDotActive: { backgroundColor: colors.primary[500], width: 20 },
  wizardStepLabel: { fontSize: typography.fontSize.xs, color: colors.slate[400], textAlign: 'center', marginTop: spacing.xs },
  wizardTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.slate[900], marginBottom: spacing.sm },
  wizardDesc: { fontSize: typography.fontSize.sm, color: colors.slate[500], marginBottom: spacing.lg },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  amountInput: { flex: 1, height: 48, borderWidth: 2, borderColor: colors.primary[300], borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.slate[900] },
  quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.slate[200], marginBottom: 8 },
  optionRowActive: { borderColor: colors.primary[400], backgroundColor: colors.primary[50] },
  optionLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[800] },
  optionDesc: { fontSize: typography.fontSize.xs, color: colors.slate[500], marginTop: 2 },
  wizardNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, gap: spacing.md },

  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sliderLabel: { fontSize: typography.fontSize.xs, color: colors.slate[500], width: 48 },
  sliderTrack: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  sliderDot: { width: 40, height: 32, borderRadius: borderRadius.md, backgroundColor: colors.slate[100], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.slate[200] },
  sliderDotActive: { backgroundColor: colors.primary[100], borderColor: colors.primary[400] },
  sliderDotText: { fontSize: 10, color: colors.slate[500], fontWeight: typography.fontWeight.medium },
  sliderDotTextActive: { color: colors.primary[700], fontWeight: typography.fontWeight.bold },

  dualColorBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: spacing.md },
  dualColorIncome: { backgroundColor: colors.info[400] },
  dualColorGrowth: { backgroundColor: colors.primary[400] },
  dualColorLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },

  // Sector grid
  sectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  sectorBtn: { width: '30%' as any, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.slate[200], alignItems: 'center', gap: spacing.xs, backgroundColor: colors.white },
  sectorBtnOverweight: { borderColor: colors.primary[400], backgroundColor: colors.primary[50] },
  sectorBtnExclude: { borderColor: colors.error[400], backgroundColor: colors.error[50] },
  sectorBtnText: { fontSize: 10, fontWeight: typography.fontWeight.medium, color: colors.slate[600], textAlign: 'center' },
  sectorBtnTextActive: { color: colors.white },
  esgRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.slate[100], marginTop: spacing.md },

  // Holdings
  holdingChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.slate[100], borderRadius: borderRadius.full },
  holdingChipText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.slate[700] },

  // Review
  reviewGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  reviewItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  reviewLabel: { fontSize: typography.fontSize.sm, color: colors.slate[500] },
  reviewValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[900], maxWidth: '60%' as any },
  reviewEditBtn: { fontSize: typography.fontSize.xs, color: colors.primary[600], fontWeight: typography.fontWeight.semibold },

  // Portfolio results
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  posRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  posLeft: { flex: 1, minWidth: 0 },
  posRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posTicker: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.slate[900] },
  posName: { fontSize: typography.fontSize.xs, color: colors.slate[500], marginTop: 2 },
  posSector: { fontSize: 10, color: colors.slate[400], marginTop: 2 },
  posWeight: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.primary[700] },
  posAmount: { fontSize: typography.fontSize.xs, color: colors.slate[500] },
  posRationaleBox: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.slate[50], borderRadius: borderRadius.md, marginBottom: spacing.sm },

  // Sector allocation
  sectorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8 },
  sectorName: { fontSize: typography.fontSize.xs, color: colors.slate[600], width: 80 },
  sectorBarBg: { flex: 1, height: 8, backgroundColor: colors.slate[100], borderRadius: 4, overflow: 'hidden' },
  sectorBarFill: { height: '100%', backgroundColor: colors.primary[500], borderRadius: 4 },
  sectorPct: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.slate[700], width: 36, textAlign: 'right' },

  riskItem: { fontSize: typography.fontSize.sm, color: colors.warning[700], lineHeight: 22, marginBottom: 4 },
});
