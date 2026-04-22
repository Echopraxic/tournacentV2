import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormTask {
  id: string;
  title: string;
  description: string;
  form_id: string | null;
  points: number;
}

interface FormModalProps {
  visible: boolean;
  task: FormTask | null;
  challengeId: string;
  userId: string;
  totalPoints: number;
  onClose: () => void;
  onComplete: (points: number) => void;
}

type DebtRow = { id: string; name: string; balance: string; apr: string };
type BillRow = { id: string; provider: string; rate: string; contractEnd: string };
type SavingsRow = { id: string; provider: string; oldRate: string; newRate: string };
type ETFEntry = { ticker: string; rationale: string };

// ─── Module-level helpers ─────────────────────────────────────────────────────

let _uid = 0;
const uid = () => String(++_uid);

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

const KNOWN_FORM_IDS = new Set([
  'apr_calculator',
  'debt_avalanche',
  'investment_goal',
  'etf_research',
  'bill_audit',
  'annual_savings',
  'compound_growth',
]);

const truncate = (s: string, max: number) => s.slice(0, max);

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

function FieldInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={[s.input, props.style as any]} {...props} />;
}

function ResultRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={s.resultRow}>
      <Text style={s.resultLabel}>{label}</Text>
      <Text style={[s.resultValue, accent ? s.resultValueAccent : null]}>{value}</Text>
    </View>
  );
}

// ─── FormModal ────────────────────────────────────────────────────────────────

export function FormModal({
  visible,
  task,
  challengeId,
  userId,
  totalPoints,
  onClose,
  onComplete,
}: FormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // APR Calculator
  const [aprBalance, setAprBalance] = useState('');
  const [aprRate, setAprRate] = useState('');
  const [aprMinPayment, setAprMinPayment] = useState('');
  const [aprCalculated, setAprCalculated] = useState(false);

  // Debt Avalanche
  const [debtRows, setDebtRows] = useState<DebtRow[]>([
    { id: uid(), name: '', balance: '', apr: '' },
    { id: uid(), name: '', balance: '', apr: '' },
  ]);
  const [avalancheCalculated, setAvalancheCalculated] = useState(false);

  // Investment Goal
  const [investTarget, setInvestTarget] = useState('');
  const [investYears, setInvestYears] = useState('');

  // ETF Research
  const [etfs, setEtfs] = useState<ETFEntry[]>([
    { ticker: '', rationale: '' },
    { ticker: '', rationale: '' },
    { ticker: '', rationale: '' },
  ]);

  // Bill Audit
  const [billRows, setBillRows] = useState<BillRow[]>(
    Array.from({ length: 5 }, () => ({ id: uid(), provider: '', rate: '', contractEnd: '' }))
  );

  // Annual Savings
  const [savingsRows, setSavingsRows] = useState<SavingsRow[]>([
    { id: uid(), provider: '', oldRate: '', newRate: '' },
  ]);

  // Compound Growth
  const [cgPrincipal, setCgPrincipal] = useState('');
  const [cgMonthly, setCgMonthly] = useState('');
  const [cgRate, setCgRate] = useState('');
  const [cgYears, setCgYears] = useState('10');

  // ── Derived calculations ───────────────────────────────────────────────────

  const aprResults = useMemo(() => {
    if (!aprCalculated) return null;
    const balance = parseFloat(aprBalance);
    const r = parseFloat(aprRate) / 100 / 12;
    const pmt = parseFloat(aprMinPayment);
    if (!balance || !r || !pmt) return null;
    const monthlyInterest = balance * r;
    if (pmt <= monthlyInterest) {
      return { canPayOff: false as const, monthlyInterest };
    }
    const months = Math.ceil(-Math.log(1 - (r * balance) / pmt) / Math.log(1 + r));
    return {
      canPayOff: true as const,
      monthlyInterest,
      months,
      totalInterest: months * pmt - balance,
    };
  }, [aprCalculated, aprBalance, aprRate, aprMinPayment]);

  const avalancheOrder = useMemo(() => {
    if (!avalancheCalculated) return [] as DebtRow[];
    return [...debtRows]
      .filter(r => r.name.trim() && r.balance && r.apr)
      .sort((a, b) => parseFloat(b.apr) - parseFloat(a.apr));
  }, [avalancheCalculated, debtRows]);

  const annualSavingsTotal = useMemo(
    () =>
      savingsRows.reduce((sum, r) => {
        const diff = (parseFloat(r.oldRate) || 0) - (parseFloat(r.newRate) || 0);
        return sum + (diff > 0 ? diff * 12 : 0);
      }, 0),
    [savingsRows]
  );

  const cgProjection = useMemo(() => {
    const P = parseFloat(cgPrincipal) || 0;
    const pmt = parseFloat(cgMonthly) || 0;
    const annualRate = parseFloat(cgRate) || 0;
    const years = Math.max(1, Math.min(parseInt(cgYears) || 10, 30));
    const r = annualRate / 100 / 12;
    return Array.from({ length: years }, (_, i) => {
      const n = (i + 1) * 12;
      const fv =
        r === 0
          ? P + pmt * n
          : P * Math.pow(1 + r, n) + pmt * ((Math.pow(1 + r, n) - 1) / r);
      return { year: i + 1, value: fv };
    });
  }, [cgPrincipal, cgMonthly, cgRate, cgYears]);

  // ── Validation ─────────────────────────────────────────────────────────────

  const etfValid = etfs.every(e => e.ticker.trim() && countWords(e.rationale) >= 50);
  const billCompleteCount = billRows.filter(
    r => r.provider.trim() && r.rate && r.contractEnd
  ).length;

  const canSubmit = (): boolean => {
    switch (task?.form_id) {
      case 'apr_calculator':
        return !!aprResults && aprResults.canPayOff;
      case 'debt_avalanche':
        return avalancheOrder.length >= 2;
      case 'investment_goal':
        return !!investTarget && parseFloat(investYears) >= 5;
      case 'etf_research':
        return etfValid;
      case 'bill_audit':
        return billCompleteCount >= 5;
      case 'annual_savings':
        return (
          savingsRows.some(r => r.provider && r.oldRate && r.newRate) &&
          annualSavingsTotal > 0
        );
      case 'compound_growth':
        return !!(cgPrincipal && cgRate && cgYears);
      default:
        return false;
    }
  };

  // ── Reset / close ──────────────────────────────────────────────────────────

  const resetState = () => {
    setAprBalance('');
    setAprRate('');
    setAprMinPayment('');
    setAprCalculated(false);
    setDebtRows([
      { id: uid(), name: '', balance: '', apr: '' },
      { id: uid(), name: '', balance: '', apr: '' },
    ]);
    setAvalancheCalculated(false);
    setInvestTarget('');
    setInvestYears('');
    setEtfs([
      { ticker: '', rationale: '' },
      { ticker: '', rationale: '' },
      { ticker: '', rationale: '' },
    ]);
    setBillRows(
      Array.from({ length: 5 }, () => ({ id: uid(), provider: '', rate: '', contractEnd: '' }))
    );
    setSavingsRows([{ id: uid(), provider: '', oldRate: '', newRate: '' }]);
    setCgPrincipal('');
    setCgMonthly('');
    setCgRate('');
    setCgYears('10');
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const buildFormData = (): Record<string, any> => {
    switch (task?.form_id) {
      case 'apr_calculator':
        return {
          balance: aprBalance,
          apr: aprRate,
          min_payment: aprMinPayment,
          monthly_interest: aprResults?.monthlyInterest,
          months_to_payoff: aprResults?.canPayOff ? aprResults.months : null,
          total_interest: aprResults?.canPayOff ? aprResults.totalInterest : null,
        };
      case 'debt_avalanche':
        return {
          debts: avalancheOrder.map(r => ({
            name: truncate(r.name.trim(), 100),
            balance: r.balance,
            apr: r.apr,
          })),
        };
      case 'investment_goal':
        return { target_amount: investTarget, timeline_years: investYears };
      case 'etf_research':
        return {
          etfs: etfs.map(e => ({
            ticker: truncate(e.ticker.trim(), 10),
            rationale: truncate(e.rationale.trim(), 2000),
            word_count: countWords(e.rationale),
          })),
        };
      case 'bill_audit':
        return {
          bills: billRows
            .filter(r => r.provider)
            .map(r => ({
              provider: truncate(r.provider.trim(), 100),
              rate: r.rate,
              contract_end: truncate(r.contractEnd.trim(), 10),
            })),
        };
      case 'annual_savings':
        return {
          reductions: savingsRows
            .filter(r => r.provider)
            .map(r => ({
              provider: truncate(r.provider.trim(), 100),
              old_rate: r.oldRate,
              new_rate: r.newRate,
            })),
          annual_total: annualSavingsTotal,
        };
      case 'compound_growth':
        return {
          principal: cgPrincipal,
          monthly_contribution: cgMonthly,
          annual_return: cgRate,
          years: cgYears,
          final_value: cgProjection[cgProjection.length - 1]?.value,
          projection: cgProjection,
        };
      default:
        return {};
    }
  };

  const handleSubmit = async () => {
    if (!task || !canSubmit() || submitting) return;
    if (!task.form_id || !KNOWN_FORM_IDS.has(task.form_id)) {
      setError('Unknown form type — cannot submit.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: formErr } = await supabase.from('task_form_submissions').insert({
        user_id: userId,
        task_id: task.id,
        challenge_id: challengeId,
        form_id: task.form_id,
        form_data: buildFormData(),
      });
      if (formErr) throw formErr;

      const { error: completionErr } = await supabase.from('task_completions').insert({
        task_id: task.id,
        user_id: userId,
        challenge_id: challengeId,
      });
      if (completionErr) throw completionErr;

      const { error: pointsErr } = await supabase
        .from('challenge_participants')
        .update({ points: totalPoints + task.points })
        .eq('user_id', userId)
        .eq('challenge_id', challengeId);
      if (pointsErr) throw pointsErr;

      resetState();
      onComplete(task.points);
    } catch (err: any) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Row mutation helpers ───────────────────────────────────────────────────

  const updateDebtRow = (i: number, field: keyof DebtRow, value: string) => {
    setDebtRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
    setAvalancheCalculated(false);
  };
  const addDebtRow = () =>
    setDebtRows(prev => [...prev, { id: uid(), name: '', balance: '', apr: '' }]);
  const removeDebtRow = (i: number) =>
    setDebtRows(prev => prev.filter((_, idx) => idx !== i));

  const updateBillRow = (i: number, field: keyof BillRow, value: string) =>
    setBillRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const updateSavingsRow = (i: number, field: keyof SavingsRow, value: string) =>
    setSavingsRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  // ── Form renderers ─────────────────────────────────────────────────────────

  const renderAprCalculator = () => (
    <>
      <Label>Current Balance ($)</Label>
      <FieldInput
        value={aprBalance}
        onChangeText={v => { setAprBalance(v); setAprCalculated(false); }}
        placeholder="e.g. 5000"
        keyboardType="decimal-pad"
      />
      <Label>Annual Interest Rate (APR %)</Label>
      <FieldInput
        value={aprRate}
        onChangeText={v => { setAprRate(v); setAprCalculated(false); }}
        placeholder="e.g. 22.99"
        keyboardType="decimal-pad"
      />
      <Label>Minimum Monthly Payment ($)</Label>
      <FieldInput
        value={aprMinPayment}
        onChangeText={v => { setAprMinPayment(v); setAprCalculated(false); }}
        placeholder="e.g. 150"
        keyboardType="decimal-pad"
      />
      <TouchableOpacity
        style={[s.calcBtn, !(aprBalance && aprRate && aprMinPayment) && s.calcBtnDisabled]}
        onPress={() => setAprCalculated(true)}
        disabled={!(aprBalance && aprRate && aprMinPayment)}
      >
        <Text style={s.calcBtnText}>Calculate</Text>
      </TouchableOpacity>

      {aprResults && (
        <View style={s.resultBox}>
          <ResultRow
            label="Monthly Interest Cost"
            value={`$${fmt(aprResults.monthlyInterest)}`}
          />
          {aprResults.canPayOff ? (
            <>
              <ResultRow label="Months to Pay Off" value={String(aprResults.months)} />
              <ResultRow
                label="Total Interest Paid"
                value={`$${fmt(aprResults.totalInterest)}`}
                accent
              />
            </>
          ) : (
            <Text style={s.warningText}>
              Your minimum payment doesn't cover the monthly interest. Increase your payment to
              make progress on the principal.
            </Text>
          )}
        </View>
      )}
    </>
  );

  const renderDebtAvalanche = () => (
    <>
      <Text style={s.formHint}>
        List your debts. The avalanche method pays the highest APR first to minimize total
        interest.
      </Text>
      {debtRows.map((row, i) => (
        <View key={row.id} style={s.dynamicRow}>
          <View style={{ flex: 2 }}>
            <TextInput
              style={s.tableInput}
              value={row.name}
              onChangeText={v => updateDebtRow(i, 'name', v)}
              placeholder="Debt name"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={s.tableInput}
              value={row.balance}
              onChangeText={v => updateDebtRow(i, 'balance', v)}
              placeholder="Balance"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={s.tableInput}
              value={row.apr}
              onChangeText={v => updateDebtRow(i, 'apr', v)}
              placeholder="APR%"
              keyboardType="decimal-pad"
            />
          </View>
          {debtRows.length > 2 ? (
            <TouchableOpacity onPress={() => removeDebtRow(i)} style={s.removeBtn}>
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>
      ))}
      <TouchableOpacity style={s.addRowBtn} onPress={addDebtRow}>
        <Plus size={16} color="#10B981" />
        <Text style={s.addRowBtnText}>Add Debt</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          s.calcBtn,
          debtRows.filter(r => r.name && r.balance && r.apr).length < 2 && s.calcBtnDisabled,
        ]}
        onPress={() => setAvalancheCalculated(true)}
        disabled={debtRows.filter(r => r.name && r.balance && r.apr).length < 2}
      >
        <Text style={s.calcBtnText}>Calculate Payoff Order</Text>
      </TouchableOpacity>

      {avalancheCalculated && avalancheOrder.length > 0 && (
        <View style={s.resultBox}>
          <Text style={s.resultTitle}>Payoff Order — Highest APR First</Text>
          {avalancheOrder.map((row, i) => (
            <View key={row.id} style={s.avalancheResultRow}>
              <Text style={s.avalancheRank}>{i + 1}.</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.avalancheName}>{row.name}</Text>
                <Text style={s.avalancheDetail}>
                  ${fmt(parseFloat(row.balance))} @ {row.apr}% APR
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );

  const renderInvestmentGoal = () => (
    <>
      <Label>Target Investment Amount ($)</Label>
      <FieldInput
        value={investTarget}
        onChangeText={setInvestTarget}
        placeholder="e.g. 10000"
        keyboardType="decimal-pad"
      />
      <Label>Timeline (years, minimum 5)</Label>
      <FieldInput
        value={investYears}
        onChangeText={setInvestYears}
        placeholder="e.g. 10"
        keyboardType="number-pad"
      />
      {!!investYears && parseFloat(investYears) < 5 && (
        <Text style={s.warningText}>Timeline must be at least 5 years.</Text>
      )}
    </>
  );

  const renderEtfResearch = () => (
    <>
      <Text style={s.formHint}>
        Document 3 ETFs with a ticker symbol and at least 50-word rationale each.
      </Text>
      {etfs.map((etf, i) => {
        const words = countWords(etf.rationale);
        const valid = etf.ticker.trim() && words >= 50;
        return (
          <View key={i} style={[s.etfCard, valid ? s.etfCardValid : null]}>
            <Text style={s.etfLabel}>ETF #{i + 1}</Text>
            <Label>Ticker Symbol</Label>
            <FieldInput
              value={etf.ticker}
              onChangeText={v =>
                setEtfs(prev =>
                  prev.map((e, idx) => (idx === i ? { ...e, ticker: v.toUpperCase() } : e))
                )
              }
              placeholder="e.g. VTI"
              autoCapitalize="characters"
            />
            <Label>Rationale</Label>
            <TextInput
              style={[s.input, s.textArea]}
              value={etf.rationale}
              onChangeText={v =>
                setEtfs(prev =>
                  prev.map((e, idx) => (idx === i ? { ...e, rationale: v } : e))
                )
              }
              placeholder="Explain why you selected this ETF (50+ words)…"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[s.wordCount, words >= 50 ? s.wordCountOk : s.wordCountLow]}>
              {words} / 50 words{words >= 50 ? ' ✓' : ''}
            </Text>
          </View>
        );
      })}
    </>
  );

  const renderBillAudit = () => (
    <>
      <Text style={s.formHint}>
        List at least 5 recurring bills with provider name, monthly rate, and contract end date.
      </Text>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderText, { flex: 2 }]}>Provider</Text>
        <Text style={[s.tableHeaderText, { flex: 1 }]}>$/mo</Text>
        <Text style={[s.tableHeaderText, { flex: 1.2 }]}>End</Text>
        <View style={{ width: 28 }} />
      </View>
      {billRows.map((row, i) => (
        <View key={row.id} style={s.tableRow}>
          <View style={{ flex: 2 }}>
            <TextInput
              style={s.tableInput}
              value={row.provider}
              onChangeText={v => updateBillRow(i, 'provider', v)}
              placeholder="Provider"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={s.tableInput}
              value={row.rate}
              onChangeText={v => updateBillRow(i, 'rate', v)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1.2 }}>
            <TextInput
              style={s.tableInput}
              value={row.contractEnd}
              onChangeText={v => updateBillRow(i, 'contractEnd', v)}
              placeholder="MM/YY"
            />
          </View>
          {billRows.length > 5 ? (
            <TouchableOpacity
              onPress={() => setBillRows(prev => prev.filter((_, idx) => idx !== i))}
              style={s.removeBtn}
            >
              <Trash2 size={14} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>
      ))}
      <TouchableOpacity
        style={s.addRowBtn}
        onPress={() =>
          setBillRows(prev => [
            ...prev,
            { id: uid(), provider: '', rate: '', contractEnd: '' },
          ])
        }
      >
        <Plus size={16} color="#10B981" />
        <Text style={s.addRowBtnText}>Add Bill</Text>
      </TouchableOpacity>
      <Text style={[s.formHint, { marginTop: 4 }]}>
        {billCompleteCount} / 5 minimum complete
      </Text>
    </>
  );

  const renderAnnualSavings = () => (
    <>
      <Text style={s.formHint}>
        Enter each confirmed rate reduction. Annual savings are computed automatically.
      </Text>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderText, { flex: 2 }]}>Provider</Text>
        <Text style={[s.tableHeaderText, { flex: 1 }]}>Old $/mo</Text>
        <Text style={[s.tableHeaderText, { flex: 1 }]}>New $/mo</Text>
        <View style={{ width: 28 }} />
      </View>
      {savingsRows.map((row, i) => (
        <View key={row.id} style={s.tableRow}>
          <View style={{ flex: 2 }}>
            <TextInput
              style={s.tableInput}
              value={row.provider}
              onChangeText={v => updateSavingsRow(i, 'provider', v)}
              placeholder="Provider"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={s.tableInput}
              value={row.oldRate}
              onChangeText={v => updateSavingsRow(i, 'oldRate', v)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={s.tableInput}
              value={row.newRate}
              onChangeText={v => updateSavingsRow(i, 'newRate', v)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          {savingsRows.length > 1 ? (
            <TouchableOpacity
              onPress={() =>
                setSavingsRows(prev => prev.filter((_, idx) => idx !== i))
              }
              style={s.removeBtn}
            >
              <Trash2 size={14} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>
      ))}
      <TouchableOpacity
        style={s.addRowBtn}
        onPress={() =>
          setSavingsRows(prev => [
            ...prev,
            { id: uid(), provider: '', oldRate: '', newRate: '' },
          ])
        }
      >
        <Plus size={16} color="#10B981" />
        <Text style={s.addRowBtnText}>Add Reduction</Text>
      </TouchableOpacity>

      {annualSavingsTotal > 0 && (
        <View style={s.resultBox}>
          <ResultRow
            label="Total Annual Savings"
            value={`$${fmt(annualSavingsTotal)}`}
            accent
          />
          <Text style={s.resultSubtext}>
            Across{' '}
            {savingsRows.filter(r => r.provider && r.oldRate && r.newRate).length}{' '}
            confirmed reduction(s)
          </Text>
        </View>
      )}
    </>
  );

  const renderCompoundGrowth = () => {
    const finalValue = cgProjection[cgProjection.length - 1]?.value ?? 0;
    const yearsNum = parseInt(cgYears) || 10;
    const totalContributions =
      (parseFloat(cgPrincipal) || 0) + (parseFloat(cgMonthly) || 0) * yearsNum * 12;
    const totalGrowth = Math.max(0, finalValue - totalContributions);
    const hasInputs = !!(cgPrincipal && cgRate);

    return (
      <>
        <Label>Starting Principal ($)</Label>
        <FieldInput
          value={cgPrincipal}
          onChangeText={setCgPrincipal}
          placeholder="e.g. 1000"
          keyboardType="decimal-pad"
        />
        <Label>Monthly Contribution ($)</Label>
        <FieldInput
          value={cgMonthly}
          onChangeText={setCgMonthly}
          placeholder="e.g. 200"
          keyboardType="decimal-pad"
        />
        <Label>Expected Annual Return (%)</Label>
        <FieldInput
          value={cgRate}
          onChangeText={setCgRate}
          placeholder="e.g. 7"
          keyboardType="decimal-pad"
        />
        <Label>Projection Period (years)</Label>
        <FieldInput
          value={cgYears}
          onChangeText={setCgYears}
          placeholder="10"
          keyboardType="number-pad"
        />

        {hasInputs && (
          <>
            <View style={s.resultBox}>
              <ResultRow label="Final Portfolio Value" value={`$${fmt(finalValue)}`} accent />
              <ResultRow label="Total Contributions" value={`$${fmt(totalContributions)}`} />
              <ResultRow label="Investment Growth" value={`$${fmt(totalGrowth)}`} />
            </View>

            <Text style={s.tableTitle}>Year-by-Year Projection</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Year</Text>
              <Text style={[s.tableHeaderText, { flex: 2, textAlign: 'right' }]}>
                Portfolio Value
              </Text>
            </View>
            {cgProjection.map(row => (
              <View key={row.year} style={s.projectionRow}>
                <Text style={[s.projectionCell, { flex: 1 }]}>Year {row.year}</Text>
                <Text
                  style={[
                    s.projectionCell,
                    { flex: 2, textAlign: 'right', fontWeight: '600' },
                  ]}
                >
                  ${fmt(row.value)}
                </Text>
              </View>
            ))}
          </>
        )}
      </>
    );
  };

  const renderFormContent = () => {
    switch (task?.form_id) {
      case 'apr_calculator':
        return renderAprCalculator();
      case 'debt_avalanche':
        return renderDebtAvalanche();
      case 'investment_goal':
        return renderInvestmentGoal();
      case 'etf_research':
        return renderEtfResearch();
      case 'bill_audit':
        return renderBillAudit();
      case 'annual_savings':
        return renderAnnualSavings();
      case 'compound_growth':
        return renderCompoundGrowth();
      default:
        return (
          <Text style={s.formHint}>Unknown form type: {task?.form_id}</Text>
        );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{task.title}</Text>
              <Text style={s.sheetDesc}>{task.description}</Text>
            </View>

            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {renderFormContent()}

              {error && <Text style={s.errorText}>{error}</Text>}

              <View style={s.buttonRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.submitBtn,
                    (!canSubmit() || submitting) && s.submitBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!canSubmit() || submitting}
                >
                  <Text style={s.submitBtnText}>
                    {submitting ? 'Submitting…' : `Submit (+${task.points} pts)`}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  sheetHeader: {
    padding: 24,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 4,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sheetDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    gap: 6,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
  },
  formHint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  calcBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  calcBtnDisabled: {
    opacity: 0.4,
  },
  calcBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  resultBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    marginTop: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  resultValueAccent: {
    fontSize: 20,
    color: '#059669',
    fontWeight: '700',
  },
  resultSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  warningText: {
    fontSize: 13,
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    lineHeight: 18,
    marginTop: 8,
  },
  dynamicRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  removeBtn: {
    padding: 4,
    marginTop: 2,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  addRowBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  avalancheResultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  avalancheRank: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
    width: 22,
  },
  avalancheName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  avalancheDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  etfCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    gap: 2,
    marginTop: 8,
  },
  etfCardValid: {
    borderColor: '#6EE7B7',
    backgroundColor: '#F0FDF4',
  },
  etfLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  wordCountOk: {
    color: '#059669',
    fontWeight: '600',
  },
  wordCountLow: {
    color: '#9CA3AF',
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 14,
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 4,
    marginTop: 6,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  projectionRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  projectionCell: {
    fontSize: 13,
    color: '#374151',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 8,
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  submitBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
