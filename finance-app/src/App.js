import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, getDoc
} from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// ── Constants ────────────────────────────────────────────────
const POCKETS = [
  { key: 'personal', label: 'Личный банк', color: '#3b82f6', icon: '🏦' },
  { key: 'business', label: 'Бизнес счёт', color: '#10b981', icon: '💼' },
  { key: 'cash',     label: 'Наличка',      color: '#f59e0b', icon: '💵' },
  { key: 'invest',   label: 'Инвестиции',   color: '#8b5cf6', icon: '📈' },
];

const EXPENSE_CATS = [
  { label: 'Еда и продукты', icon: '🛒' },
  { label: 'Кафе и рестораны', icon: '☕' },
  { label: 'Транспорт', icon: '🚗' },
  { label: 'Аренда', icon: '🏠' },
  { label: 'Коммунальные', icon: '💡' },
  { label: 'Одежда', icon: '👗' },
  { label: 'Здоровье', icon: '💊' },
  { label: 'Развлечения', icon: '🎬' },
  { label: 'Семья и дети', icon: '👶' },
  { label: 'Техника', icon: '📱' },
  { label: 'Прочее', icon: '📦' },
];

const INCOME_CATS = [
  { label: 'Дивиденды / зарплата', icon: '💰' },
  { label: 'Продажи WB', icon: '🛍️' },
  { label: 'Доход ПВЗ', icon: '📦' },
  { label: 'Возврат', icon: '↩️' },
  { label: 'Прочий доход', icon: '➕' },
];

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) => {
  const abs = Math.abs(Math.round(n));
  if (abs >= 1000000) return (n < 0 ? '-' : '') + (abs / 1000000).toFixed(1) + 'М ₽';
  if (abs >= 1000) return (n < 0 ? '-' : '') + Math.round(abs / 1000) + 'К ₽';
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
};

const fmtFull = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = (d) => d.toISOString().slice(0, 7);
const nowMonth = () => monthStr(new Date());

// ── Styles ───────────────────────────────────────────────────
const S = {
  app: { minHeight: '100vh', paddingBottom: 80, maxWidth: 480, margin: '0 auto' },
  header: { padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: 600, color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  section: { padding: '0 16px', marginTop: 24 },
  card: { background: '#1e293b', borderRadius: 16, padding: '16px', border: '1px solid rgba(255,255,255,0.06)' },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  value: { fontSize: 28, fontWeight: 600 },
  badge: (color, bg) => ({
    fontSize: 11, fontWeight: 500, padding: '3px 8px',
    borderRadius: 99, background: bg, color: color
  }),
  btn: (variant = 'default') => {
    const base = { borderRadius: 12, padding: '12px 20px', fontSize: 15, fontWeight: 500, transition: 'opacity 0.15s' };
    if (variant === 'primary') return { ...base, background: '#3b82f6', color: '#fff' };
    if (variant === 'ghost') return { ...base, background: 'rgba(255,255,255,0.06)', color: '#f1f5f9' };
    if (variant === 'danger') return { ...base, background: '#450a0a', color: '#ef4444' };
    return { ...base, background: '#334155', color: '#f1f5f9' };
  },
  input: {
    width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: 15,
  },
  select: {
    width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: 15,
    appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
  },
  divider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 0' },
  bottomNav: {
    position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: '100%', maxWidth: 480, background: '#1e293b',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)',
  },
  navBtn: (active) => ({
    flex: 1, padding: '12px 0 10px', background: 'none', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: 3,
    color: active ? '#3b82f6' : '#64748b', fontSize: 11, fontWeight: active ? 500 : 400,
  }),
};

// ── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1e293b', borderRadius: '20px 20px 0 0', width: '100%',
        maxWidth: 480, padding: '20px 20px 36px', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: '#334155', border: 'none', color: '#94a3b8', borderRadius: 99, width: 32, height: 32, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────
function Overview({ pockets, transactions, budgets, viewMonth, setViewMonth }) {
  const vtx = transactions.filter(t => t.date?.slice(0, 7) === viewMonth);
  const income = vtx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = vtx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savings = income > 0 ? Math.round((balance / income) * 100) : null;
  const totalPockets = Object.values(pockets).reduce((s, v) => s + v, 0);

  const changeMonth = (d) => {
    const [y, m] = viewMonth.split('-').map(Number);
    const nd = new Date(y, m - 1 + d, 1);
    setViewMonth(nd.toISOString().slice(0, 7));
  };

  const [y, m] = viewMonth.split('-').map(Number);

  // Last 6 months chart data
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const mo = d.toISOString().slice(0, 7);
    const mtx = transactions.filter(t => t.date?.slice(0, 7) === mo);
    return {
      name: MONTHS_RU[d.getMonth()].slice(0, 3),
      income: mtx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: mtx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });

  // Budget alerts
  const budgetAlerts = Object.entries(budgets).filter(([cat, limit]) => {
    const spent = vtx.filter(t => t.type === 'expense' && t.cat === cat).reduce((s, t) => s + t.amount, 0);
    return spent > limit * 0.8;
  });

  return (
    <div>
      {/* Total */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Всего во всех карманах</div>
        <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: -1 }}>{fmtFull(totalPockets)}</div>
      </div>

      {/* Pockets */}
      <div style={{ ...S.section, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {POCKETS.map(p => (
          <div key={p.key} style={{ ...S.card, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: p.color, borderRadius: '16px 0 0 16px' }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{p.icon} {p.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(pockets[p.key] || 0)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget alerts */}
      {budgetAlerts.length > 0 && (
        <div style={{ ...S.section }}>
          {budgetAlerts.map(([cat, limit]) => {
            const spent = vtx.filter(t => t.type === 'expense' && t.cat === cat).reduce((s, t) => s + t.amount, 0);
            const over = spent > limit;
            return (
              <div key={cat} style={{ ...S.card, background: over ? '#450a0a' : '#451a03', border: `1px solid ${over ? '#ef4444' : '#f59e0b'}22`, marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: over ? '#ef4444' : '#f59e0b', fontWeight: 500 }}>
                  {over ? '⚠️ Превышен лимит' : '⚡ Почти достигнут лимит'}: {cat}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {fmtFull(spent)} из {fmtFull(limit)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month nav */}
      <div style={{ ...S.section }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={() => changeMonth(-1)} style={{ ...S.btn('ghost'), padding: '8px 14px' }}>‹</button>
          <span style={{ fontWeight: 500 }}>{MONTHS_RU[m - 1]} {y}</span>
          <button onClick={() => changeMonth(1)} style={{ ...S.btn('ghost'), padding: '8px 14px' }}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={S.card}>
            <div style={S.label}>Доход</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#10b981' }}>{fmt(income)}</div>
          </div>
          <div style={S.card}>
            <div style={S.label}>Расход</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#ef4444' }}>{fmt(expense)}</div>
          </div>
          <div style={S.card}>
            <div style={S.label}>Баланс месяца</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: balance >= 0 ? '#10b981' : '#ef4444' }}>{fmt(balance)}</div>
          </div>
          <div style={S.card}>
            <div style={S.label}>Сбережения</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: savings >= 20 ? '#10b981' : savings < 0 ? '#ef4444' : '#f59e0b' }}>
              {savings !== null ? savings + '%' : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ ...S.section }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>Последние 6 месяцев</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v) => fmtFull(v)}
                contentStyle={{ background: '#334155', border: 'none', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center', fontSize: 12, color: '#64748b' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', borderRadius: 2, marginRight: 4 }} />Доход</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />Расход</span>
          </div>
        </div>
      </div>

      {/* Recent */}
      <div style={{ ...S.section }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#94a3b8' }}>Последние транзакции</div>
        <div style={S.card}>
          {transactions.slice(0, 5).length === 0
            ? <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Нет транзакций</div>
            : transactions.slice(0, 5).map(t => (
              <TxRow key={t.id} t={t} />
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ── Transaction Row ──────────────────────────────────────────
function TxRow({ t, onDelete }) {
  const pocket = POCKETS.find(p => p.key === t.pocket);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: t.type === 'income' ? '#064e3b' : '#450a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        {[...EXPENSE_CATS, ...INCOME_CATS].find(c => c.label === t.cat)?.icon || '💸'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.cat}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {t.date} · {pocket?.label || t.pocket}{t.note ? ' · ' + t.note : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
          {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
        </div>
      </div>
      {onDelete && (
        <button onClick={() => onDelete(t.id)} style={{ background: 'none', color: '#64748b', fontSize: 20, padding: '0 4px', flexShrink: 0 }}>×</button>
      )}
    </div>
  );
}

// ── Transactions Tab ─────────────────────────────────────────
function Transactions({ transactions, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(EXPENSE_CATS[0].label);
  const [pocket, setPocket] = useState(POCKETS[0].key);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('all');

  const cats = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  const handleAdd = () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return alert('Введи корректную сумму');
    onAdd({ type, amount: a, cat, pocket, date, note });
    setAmount(''); setNote(''); setShowForm(false);
  };

  const filtered = transactions.filter(t => filter === 'all' || t.type === filter);

  return (
    <div>
      <div style={{ padding: '20px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 600 }}>Транзакции</span>
        <button onClick={() => setShowForm(true)} style={{ ...S.btn('primary'), padding: '10px 18px', fontSize: 22, lineHeight: 1 }}>+</button>
      </div>

      {/* Filter */}
      <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8 }}>
        {['all', 'income', 'expense'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            ...S.btn(filter === f ? 'primary' : 'ghost'),
            padding: '8px 14px', fontSize: 13,
            background: filter === f ? '#3b82f6' : 'rgba(255,255,255,0.06)'
          }}>
            {f === 'all' ? 'Все' : f === 'income' ? 'Доходы' : 'Расходы'}
          </button>
        ))}
      </div>

      <div style={{ ...S.section }}>
        <div style={S.card}>
          {filtered.length === 0
            ? <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Нет транзакций</div>
            : filtered.map(t => <TxRow key={t.id} t={t} onDelete={onDelete} />)
          }
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Добавить транзакцию">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <button onClick={() => { setType('expense'); setCat(EXPENSE_CATS[0].label); }} style={{
            ...S.btn(type === 'expense' ? 'default' : 'ghost'), background: type === 'expense' ? '#ef4444' : 'rgba(255,255,255,0.06)',
            color: '#fff', fontWeight: type === 'expense' ? 600 : 400
          }}>Расход</button>
          <button onClick={() => { setType('income'); setCat(INCOME_CATS[0].label); }} style={{
            ...S.btn(type === 'income' ? 'default' : 'ghost'), background: type === 'income' ? '#10b981' : 'rgba(255,255,255,0.06)',
            color: '#fff', fontWeight: type === 'income' ? 600 : 400
          }}>Доход</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Сумма (₽)</div>
          <input style={S.input} type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Категория</div>
          <select style={S.select} value={cat} onChange={e => setCat(e.target.value)}>
            {cats.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Карман</div>
          <select style={S.select} value={pocket} onChange={e => setPocket(e.target.value)}>
            {POCKETS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Дата</div>
          <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={S.label}>Комментарий</div>
          <input style={S.input} type="text" placeholder="Необязательно" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <button onClick={handleAdd} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center' }}>Добавить</button>
      </Modal>
    </div>
  );
}

// ── Analytics Tab ────────────────────────────────────────────
function Analytics({ transactions, budgets, setBudgets, viewMonth, setViewMonth }) {
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetCat, setBudgetCat] = useState(EXPENSE_CATS[0].label);
  const [budgetAmt, setBudgetAmt] = useState('');

  const changeMonth = (d) => {
    const [y, m] = viewMonth.split('-').map(Number);
    const nd = new Date(y, m - 1 + d, 1);
    setViewMonth(nd.toISOString().slice(0, 7));
  };
  const [y, m] = viewMonth.split('-').map(Number);

  const vtx = transactions.filter(t => t.date?.slice(0, 7) === viewMonth);

  const catTotals = (type) => {
    const map = {};
    vtx.filter(t => t.type === type).forEach(t => { map[t.cat] = (map[t.cat] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const expenseTotals = catTotals('expense');
  const incomeTotals = catTotals('income');
  const totalExpense = expenseTotals.reduce((s, [, v]) => s + v, 0);
  const totalIncome = incomeTotals.reduce((s, [, v]) => s + v, 0);

  const handleSetBudget = async () => {
    const a = parseFloat(budgetAmt);
    if (!a) return;
    const updated = { ...budgets, [budgetCat]: a };
    setBudgets(updated);
    await setDoc(doc(db, 'settings', 'budgets'), updated);
    setBudgetAmt('');
    setShowBudgetModal(false);
  };

  const deleteBudget = async (cat) => {
    const updated = { ...budgets };
    delete updated[cat];
    setBudgets(updated);
    await setDoc(doc(db, 'settings', 'budgets'), updated);
  };

  return (
    <div>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 14 }}>Аналитика</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => changeMonth(-1)} style={{ ...S.btn('ghost'), padding: '8px 14px' }}>‹</button>
          <span style={{ fontWeight: 500 }}>{MONTHS_RU[m - 1]} {y}</span>
          <button onClick={() => changeMonth(1)} style={{ ...S.btn('ghost'), padding: '8px 14px' }}>›</button>
        </div>
      </div>

      {/* Expense breakdown */}
      <div style={S.section}>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 10 }}>Расходы по категориям</div>
        <div style={S.card}>
          {expenseTotals.length === 0
            ? <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Нет данных</div>
            : expenseTotals.map(([cat, amt]) => {
              const pct = totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0;
              const icon = EXPENSE_CATS.find(c => c.label === cat)?.icon || '📦';
              const budget = budgets[cat];
              const over = budget && amt > budget;
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                    <span>{icon} {cat} {over && '⚠️'}</span>
                    <span style={{ fontWeight: 500, color: over ? '#ef4444' : '#f1f5f9' }}>{fmt(amt)} <span style={{ color: '#64748b', fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: over ? '#ef4444' : '#3b82f6', borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                  {budget && (
                    <div style={{ fontSize: 11, color: over ? '#ef4444' : '#64748b', marginTop: 3 }}>
                      Лимит: {fmtFull(budget)} · {over ? 'Превышен на ' + fmtFull(amt - budget) : 'Осталось ' + fmtFull(budget - amt)}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Income breakdown */}
      <div style={S.section}>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 10 }}>Доходы по категориям</div>
        <div style={S.card}>
          {incomeTotals.length === 0
            ? <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Нет данных</div>
            : incomeTotals.map(([cat, amt]) => {
              const pct = totalIncome > 0 ? Math.round(amt / totalIncome * 100) : 0;
              const icon = INCOME_CATS.find(c => c.label === cat)?.icon || '💰';
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                    <span>{icon} {cat}</span>
                    <span style={{ fontWeight: 500 }}>{fmt(amt)} <span style={{ color: '#64748b', fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Budgets */}
      <div style={S.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, color: '#64748b' }}>Бюджетные лимиты</div>
          <button onClick={() => setShowBudgetModal(true)} style={{ ...S.btn('ghost'), padding: '6px 12px', fontSize: 13 }}>+ Добавить</button>
        </div>
        <div style={S.card}>
          {Object.keys(budgets).length === 0
            ? <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Лимиты не установлены</div>
            : Object.entries(budgets).map(([cat, limit]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: 14 }}>{cat}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Лимит: {fmtFull(limit)}</div>
                </div>
                <button onClick={() => deleteBudget(cat)} style={{ background: 'none', color: '#64748b', fontSize: 20 }}>×</button>
              </div>
            ))
          }
        </div>
      </div>

      <Modal open={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Установить лимит">
        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Категория</div>
          <select style={S.select} value={budgetCat} onChange={e => setBudgetCat(e.target.value)}>
            {EXPENSE_CATS.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={S.label}>Лимит (₽ в месяц)</div>
          <input style={S.input} type="number" placeholder="0" value={budgetAmt} onChange={e => setBudgetAmt(e.target.value)} inputMode="numeric" />
        </div>
        <button onClick={handleSetBudget} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center' }}>Сохранить</button>
      </Modal>
    </div>
  );
}

// ── Pockets Tab ──────────────────────────────────────────────
function Pockets({ pockets, setPockets }) {
  const [editing, setEditing] = useState(null);
  const [val, setVal] = useState('');

  const save = async (key) => {
    const v = parseFloat(val);
    if (isNaN(v)) return;
    const updated = { ...pockets, [key]: v };
    setPockets(updated);
    await setDoc(doc(db, 'settings', 'pockets'), updated);
    setEditing(null);
  };

  const total = Object.values(pockets).reduce((s, v) => s + v, 0);

  return (
    <div>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Мои карманы</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Итого: {fmtFull(total)}</div>
      </div>

      <div style={S.section}>
        {POCKETS.map(p => (
          <div key={p.key} style={{ ...S.card, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: p.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {p.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#64748b' }}>{p.label}</div>
                {editing === p.key ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input
                      style={{ ...S.input, flex: 1 }}
                      type="number"
                      value={val}
                      onChange={e => setVal(e.target.value)}
                      inputMode="numeric"
                      autoFocus
                    />
                    <button onClick={() => save(p.key)} style={{ ...S.btn('primary'), padding: '10px 16px' }}>✓</button>
                    <button onClick={() => setEditing(null)} style={{ ...S.btn('ghost'), padding: '10px 12px' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color: p.color }}>{fmtFull(pockets[p.key] || 0)}</div>
                    <button onClick={() => { setEditing(p.key); setVal(pockets[p.key] || 0); }}
                      style={{ ...S.btn('ghost'), padding: '8px 12px', fontSize: 13, color: '#64748b' }}>
                      Изменить
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
        Обновляй остатки когда пополняешь счёт или снимаешь наличку. Транзакции не влияют на остатки автоматически — это ручной учёт.
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [pockets, setPockets] = useState({ personal: 0, business: 0, cash: 0, invest: 0 });
  const [budgets, setBudgets] = useState({});
  const [viewMonth, setViewMonth] = useState(nowMonth());
  const [loading, setLoading] = useState(true);

  // Load pockets & budgets from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const ps = await getDoc(doc(db, 'settings', 'pockets'));
        if (ps.exists()) setPockets(ps.data());
        const bs = await getDoc(doc(db, 'settings', 'budgets'));
        if (bs.exists()) setBudgets(bs.data());
      } catch (e) { console.error(e); }
    };
    loadSettings();
  }, []);

  // Real-time transactions listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'transactions'), (snap) => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      txs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setTransactions(txs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const addTransaction = useCallback(async (tx) => {
    const id = Date.now().toString();
    await setDoc(doc(db, 'transactions', id), { ...tx, id, createdAt: new Date().toISOString() });
  }, []);

  const deleteTransaction = useCallback(async (id) => {
    await deleteDoc(doc(db, 'transactions', String(id)));
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #334155', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ color: '#64748b', fontSize: 14 }}>Загрузка...</div>
    </div>
  );

  const tabs = [
    { key: 'overview', label: 'Обзор', icon: '◉' },
    { key: 'transactions', label: 'Операции', icon: '⇅' },
    { key: 'analytics', label: 'Аналитика', icon: '▦' },
    { key: 'pockets', label: 'Карманы', icon: '⬡' },
  ];

  return (
    <div style={S.app}>
      {tab === 'overview' && (
        <Overview pockets={pockets} transactions={transactions} budgets={budgets} viewMonth={viewMonth} setViewMonth={setViewMonth} />
      )}
      {tab === 'transactions' && (
        <Transactions transactions={transactions} onAdd={addTransaction} onDelete={deleteTransaction} />
      )}
      {tab === 'analytics' && (
        <Analytics transactions={transactions} budgets={budgets} setBudgets={setBudgets} viewMonth={viewMonth} setViewMonth={setViewMonth} />
      )}
      {tab === 'pockets' && (
        <Pockets pockets={pockets} setPockets={setPockets} />
      )}

      <nav style={S.bottomNav}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={S.navBtn(tab === t.key)}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
