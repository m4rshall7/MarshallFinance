import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const SPREADSHEET_ID = '1x2FUQZgAibFeJYgxKsbGVZUGlUKoKlyp6syFSO5vBw4';
const POCKETS = [
  { key: 'personal', label: 'Личный банк',  color: '#3b82f6', icon: '🏦' },
  { key: 'business', label: 'Бизнес счёт',  color: '#10b981', icon: '💼' },
  { key: 'cash',     label: 'Наличка',       color: '#f59e0b', icon: '💵' },
  { key: 'invest',   label: 'Инвестиции',    color: '#8b5cf6', icon: '📈' },
];
const DEFAULT_EXPENSE_CATS = [
  { label: 'Еда и продукты', icon: '🛒' }, { label: 'Кафе и рестораны', icon: '☕' },
  { label: 'Транспорт', icon: '🚗' }, { label: 'Аренда', icon: '🏠' },
  { label: 'Коммунальные', icon: '💡' }, { label: 'Одежда', icon: '👗' },
  { label: 'Здоровье', icon: '💊' }, { label: 'Развлечения', icon: '🎬' },
  { label: 'Семья и дети', icon: '👶' }, { label: 'Техника', icon: '📱' },
  { label: 'Закупка товаров', icon: '📦' }, { label: 'Логистика', icon: '🚚' },
  { label: 'Фулфилмент', icon: '🏭' }, { label: 'Самовыкупы', icon: '🔄' },
  { label: 'Реклама', icon: '📣' }, { label: 'Подписка сервисов', icon: '💻' },
  { label: 'Оплата труда', icon: '👥' }, { label: 'Прочие расходы', icon: '📦' },
];
const DEFAULT_INCOME_CATS = [
  { label: 'Дивиденды / зарплата', icon: '💰' }, { label: 'Поступление от ВБ', icon: '🛍️' },
  { label: 'Доход ПВЗ', icon: '📦' }, { label: 'Вклады ДС в бизнес', icon: '💳' },
  { label: 'Возврат', icon: '↩️' }, { label: 'Прочий доход', icon: '➕' },
];
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const fmt = (n) => {
  const abs = Math.abs(Math.round(n));
  if (abs >= 1000000) return (n < 0 ? '-' : '') + (abs / 1000000).toFixed(1) + 'М ₽';
  if (abs >= 1000) return (n < 0 ? '-' : '') + Math.round(abs / 1000) + 'К ₽';
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
};
const fmtFull = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowMonth = () => new Date().toISOString().slice(0, 7);

const S = {
  app: { minHeight: '100vh', paddingBottom: 80, maxWidth: 480, margin: '0 auto' },
  card: { background: '#1e293b', borderRadius: 16, padding: '16px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  input: { width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: 15 },
  select: { width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px', color: '#f1f5f9', fontSize: 15, appearance: 'none' },
  btn: (v = 'default') => {
    const base = { borderRadius: 12, padding: '12px 20px', fontSize: 15, fontWeight: 500, cursor: 'pointer', border: 'none' };
    if (v === 'primary') return { ...base, background: '#3b82f6', color: '#fff' };
    if (v === 'ghost')   return { ...base, background: 'rgba(255,255,255,0.06)', color: '#f1f5f9' };
    if (v === 'green')   return { ...base, background: '#10b981', color: '#fff' };
    if (v === 'danger')  return { ...base, background: '#450a0a', color: '#ef4444' };
    return { ...base, background: '#334155', color: '#f1f5f9' };
  },
  navBtn: (a) => ({ flex: 1, padding: '12px 0 10px', background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: a ? '#3b82f6' : '#64748b', fontSize: 11, fontWeight: a ? 500 : 400, cursor: 'pointer' }),
  bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#1e293b', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', zIndex: 100 },
};

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 40px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: '#334155', border: 'none', color: '#94a3b8', borderRadius: 99, width: 32, height: 32, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const bg = type === 'error' ? '#450a0a' : type === 'warn' ? '#451a03' : '#064e3b';
  const cl = type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#10b981';
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: bg, color: cl, border: `1px solid ${cl}33`, borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 500, zIndex: 300, maxWidth: 400, textAlign: 'center' }}>
      {msg}
    </div>
  );
}

// ── TxRow — нажатие открывает модалку ──────────────────────────────────────────
function TxRow({ t, onSelect, allCats }) {
  const pocket = POCKETS.find(p => p.key === t.pocket);
  const icon = allCats.find(c => c.label === t.cat)?.icon || '💸';
  const isPlan = t.plan === 'plan';
  return (
    <div onClick={() => onSelect && onSelect(t)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: onSelect ? 'pointer' : 'default' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: t.type === 'income' ? '#064e3b' : isPlan ? '#1a2744' : '#450a0a', border: isPlan ? '1.5px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.cat}
          {isPlan && <span style={{ fontSize: 10, background: '#1e3a5f', color: '#60a5fa', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>ПЛАН</span>}
          {t.fromSheets && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>📊</span>}
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{t.date} · {pocket?.label || t.pocket}{t.note ? ' · ' + t.note : ''}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.type === 'income' ? '#10b981' : isPlan ? '#60a5fa' : '#ef4444', flexShrink: 0 }}>
        {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
      </div>
    </div>
  );
}

// ── TxDetailModal — детали + редактирование + удаление ────────────────────────
function TxDetailModal({ tx, open, onClose, onDelete, onSave, expenseCats, incomeCats }) {
  const [editing, setEditing] = useState(false);
  const [cat, setCat]         = useState('');
  const [date, setDate]       = useState('');
  const [note, setNote]       = useState('');
  const [plan, setPlan]       = useState('fact');

  useEffect(() => {
    if (tx) { setCat(tx.cat); setDate(tx.date); setNote(tx.note || ''); setPlan(tx.plan || 'fact'); setEditing(false); }
  }, [tx]);

  if (!tx) return null;
  const cats = tx.type === 'expense' ? expenseCats : incomeCats;
  const pocket = POCKETS.find(p => p.key === tx.pocket);
  const isPlan = tx.plan === 'plan';

  const handleSave = async () => {
    await onSave(tx.id, { cat, date, note, plan });
    onClose();
  };

  const handleDelete = async () => {
    await onDelete(tx.id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Редактировать' : 'Операция'}>
      {!editing ? (
        <>
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Категория</span>
              <span style={{ fontWeight: 500 }}>{tx.cat}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Сумма</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: tx.type === 'income' ? '#10b981' : isPlan ? '#60a5fa' : '#ef4444' }}>
                {tx.type === 'income' ? '+' : '-'}{fmtFull(tx.amount)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Дата</span>
              <span>{tx.date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Карман</span>
              <span>{pocket?.label || tx.pocket}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Тип</span>
              <span style={{ color: isPlan ? '#60a5fa' : '#10b981' }}>{isPlan ? '📋 Плановый' : '✅ Фактический'}</span>
            </div>
            {tx.note && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>Комментарий</span>
                <span style={{ maxWidth: 200, textAlign: 'right' }}>{tx.note}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditing(true)} style={{ ...S.btn('primary'), flex: 1, textAlign: 'center' }}>✏️ Редактировать</button>
            <button onClick={handleDelete} style={{ ...S.btn('danger'), flex: 1, textAlign: 'center' }}>🗑 Удалить</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={S.label}>Категория</div>
            <select style={S.select} value={cat} onChange={e => setCat(e.target.value)}>
              {cats.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={S.label}>Дата</div>
            <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={S.label}>Комментарий</div>
            <input style={S.input} type="text" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={S.label}>План или факт</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setPlan('fact')} style={{ ...S.btn(), background: plan === 'fact' ? '#10b981' : 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: plan === 'fact' ? 600 : 400 }}>✅ Факт</button>
              <button onClick={() => setPlan('plan')} style={{ ...S.btn(), background: plan === 'plan' ? '#3b82f6' : 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: plan === 'plan' ? 600 : 400 }}>📋 План</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditing(false)} style={{ ...S.btn('ghost'), flex: 1, textAlign: 'center' }}>Отмена</button>
            <button onClick={handleSave} style={{ ...S.btn('primary'), flex: 1, textAlign: 'center' }}>Сохранить</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ pockets, transactions, budgets, viewMonth, setViewMonth, allCats }) {
  const [y, m] = viewMonth.split('-').map(Number);
  const vtx = transactions.filter(t => t.date?.slice(0, 7) === viewMonth);
  const factTx = vtx.filter(t => t.plan !== 'plan');
  const income  = factTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = factTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const planExp = vtx.filter(t => t.plan === 'plan' && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savings = income > 0 ? Math.round(balance / income * 100) : null;
  const total   = Object.values(pockets).reduce((s, v) => s + v, 0);

  const changeMonth = d => {
    const nd = new Date(y, m - 1 + d, 1);
    setViewMonth(nd.toISOString().slice(0, 7));
  };

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const mo = d.toISOString().slice(0, 7);
    const mtx = transactions.filter(t => t.date?.slice(0, 7) === mo && t.plan !== 'plan');
    return {
      name: MONTHS_RU[d.getMonth()].slice(0, 3),
      income:  mtx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: mtx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });

  const alerts = Object.entries(budgets).filter(([cat, limit]) => {
    const spent = factTx.filter(t => t.type === 'expense' && t.cat === cat).reduce((s, t) => s + t.amount, 0);
    return spent > limit * 0.8;
  });

  return (
    <div>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Всего во всех карманах</div>
        <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: -1 }}>{fmtFull(total)}</div>
      </div>

      <div style={{ padding: '16px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {POCKETS.map(p => (
          <div key={p.key} style={{ ...S.card, marginBottom: 0, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: p.color }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{p.icon} {p.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(pockets[p.key] || 0)}</div>
            </div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          {alerts.map(([cat, limit]) => {
            const spent = factTx.filter(t => t.type === 'expense' && t.cat === cat).reduce((s, t) => s + t.amount, 0);
            const over = spent > limit;
            return (
              <div key={cat} style={{ ...S.card, background: over ? '#450a0a' : '#451a03', border: `1px solid ${over ? '#ef4444' : '#f59e0b'}33` }}>
                <div style={{ fontSize: 13, color: over ? '#ef4444' : '#f59e0b', fontWeight: 500 }}>
                  {over ? '⚠️ Превышен лимит' : '⚡ Почти лимит'}: {cat}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{fmtFull(spent)} из {fmtFull(limit)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => changeMonth(-1)} style={{ ...S.btn('ghost'), padding: '8px 14px' }}>‹</button>
          <span style={{ fontWeight: 500 }}>{MONTHS_RU[m - 1]} {y}</span>
          <button onClick={() => changeMonth(1)} style={{ ...S.btn('ghost'), padding: '8px 14px' }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={S.label}>Факт доход</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#10b981' }}>{fmt(income)}</div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={S.label}>Факт расход</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#ef4444' }}>{fmt(expense)}</div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={S.label}>Баланс</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: balance >= 0 ? '#10b981' : '#ef4444' }}>{fmt(balance)}</div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={S.label}>План расходов</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#60a5fa' }}>{fmt(planExp)}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>Последние 6 месяцев</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={v => fmtFull(v)} contentStyle={{ background: '#334155', border: 'none', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="income"  fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="expense" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>Последние операции</div>
          {transactions.slice(0, 5).length === 0
            ? <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>Нет транзакций</div>
            : transactions.slice(0, 5).map(t => <TxRow key={t.id} t={t} allCats={allCats} />)
          }
        </div>
      </div>
    </div>
  );
}

// ── Transactions ──────────────────────────────────────────────────────────────
function Transactions({ transactions, onAdd, onDelete, onEdit, onTransfer, expenseCats, incomeCats, allCats, showToast }) {
  const [showForm, setShowForm]         = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedTx, setSelectedTx]    = useState(null);
  const [type, setType]     = useState('expense');
  const [amount, setAmount] = useState('');
  const [cat, setCat]       = useState('');
  const [pocket, setPocket] = useState(POCKETS[0].key);
  const [date, setDate]     = useState(todayStr());
  const [note, setNote]     = useState('');
  const [plan, setPlan]     = useState('fact');
  const [filter, setFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [fromP, setFromP]   = useState(POCKETS[0].key);
  const [toP, setToP]       = useState(POCKETS[1].key);
  const [trAmt, setTrAmt]   = useState('');

  const cats = type === 'expense' ? expenseCats : incomeCats;
  useEffect(() => { if (cats.length) setCat(cats[0].label); }, [type]);

  const handleAdd = async () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return alert('Введи корректную сумму');
    await onAdd({ type, amount: a, cat, pocket, date, note, plan });
    setAmount(''); setNote(''); setPlan('fact'); setShowForm(false);
  };

  const handleTransfer = async () => {
    const a = parseFloat(trAmt);
    if (!a || a <= 0) return alert('Введи сумму');
    if (fromP === toP) return alert('Выбери разные карманы');
    await onTransfer(fromP, toP, a);
    setTrAmt(''); setShowTransfer(false);
    showToast('Перевод выполнен ✓');
  };

  let filtered = transactions.filter(t => filter === 'all' || t.type === filter);
  if (planFilter !== 'all') filtered = filtered.filter(t => (t.plan || 'fact') === planFilter);

  return (
    <div>
      <div style={{ padding: '20px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 22, fontWeight: 600 }}>Операции</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowTransfer(true)} style={{ ...S.btn('ghost'), padding: '10px 14px', fontSize: 13 }}>⇄</button>
          <button onClick={() => setShowForm(true)} style={{ ...S.btn('primary'), padding: '10px 18px', fontSize: 22, lineHeight: 1 }}>+</button>
        </div>
      </div>

      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', 'income', 'expense'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...S.btn(filter === f ? 'primary' : 'ghost'), padding: '7px 12px', fontSize: 12 }}>
            {f === 'all' ? 'Все' : f === 'income' ? 'Доходы' : 'Расходы'}
          </button>
        ))}
        {['all', 'fact', 'plan'].map(f => (
          <button key={f} onClick={() => setPlanFilter(f)} style={{ ...S.btn(planFilter === f ? 'default' : 'ghost'), padding: '7px 12px', fontSize: 12, background: planFilter === f ? (f === 'plan' ? '#1e3a5f' : '#334155') : 'rgba(255,255,255,0.06)', color: planFilter === f && f === 'plan' ? '#60a5fa' : '#f1f5f9' }}>
            {f === 'all' ? 'Все типы' : f === 'fact' ? '✅ Факт' : '📋 План'}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={S.card}>
          {filtered.length === 0
            ? <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Нет транзакций</div>
            : filtered.map(t => <TxRow key={t.id} t={t} onSelect={setSelectedTx} allCats={allCats} />)
          }
        </div>
      </div>

      {/* Detail/Edit Modal */}
      <TxDetailModal
        tx={selectedTx}
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onDelete={onDelete}
        onSave={onEdit}
        expenseCats={expenseCats}
        incomeCats={incomeCats}
      />

      {/* Add Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Добавить операцию">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {['expense', 'income'].map(tp => (
            <button key={tp} onClick={() => setType(tp)} style={{ ...S.btn(), background: type === tp ? (tp === 'expense' ? '#ef4444' : '#10b981') : 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: type === tp ? 600 : 400 }}>
              {tp === 'expense' ? 'Расход' : 'Доход'}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>План или факт</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => setPlan('fact')} style={{ ...S.btn(), background: plan === 'fact' ? '#10b981' : 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: plan === 'fact' ? 600 : 400 }}>✅ Факт</button>
            <button onClick={() => setPlan('plan')} style={{ ...S.btn(), background: plan === 'plan' ? '#3b82f6' : 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: plan === 'plan' ? 600 : 400 }}>📋 План</button>
          </div>
        </div>
        {[['Сумма (₽)', <input style={S.input} type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" />],
          ['Категория', <select style={S.select} value={cat} onChange={e => setCat(e.target.value)}>{cats.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}</select>],
          ['Карман', <select style={S.select} value={pocket} onChange={e => setPocket(e.target.value)}>{POCKETS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}</select>],
          ['Дата', <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />],
          ['Комментарий', <input style={S.input} type="text" placeholder="Необязательно" value={note} onChange={e => setNote(e.target.value)} />],
        ].map(([lbl, el]) => (
          <div key={lbl} style={{ marginBottom: 12 }}><div style={S.label}>{lbl}</div>{el}</div>
        ))}
        <button onClick={handleAdd} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center', marginTop: 8 }}>Добавить</button>
      </Modal>

      {/* Transfer Modal */}
      <Modal open={showTransfer} onClose={() => setShowTransfer(false)} title="Перевод между карманами">
        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Откуда</div>
          <select style={S.select} value={fromP} onChange={e => setFromP(e.target.value)}>
            {POCKETS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Куда</div>
          <select style={S.select} value={toP} onChange={e => setToP(e.target.value)}>
            {POCKETS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={S.label}>Сумма (₽)</div>
          <input style={S.input} type="number" placeholder="0" value={trAmt} onChange={e => setTrAmt(e.target.value)} inputMode="numeric" />
        </div>
        <button onClick={handleTransfer} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center' }}>Перевести</button>
      </Modal>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function Analytics({ transactions, budgets, setBudgets, viewMonth, setViewMonth, expenseCats, showToast }) {
  const [showBudget, setShowBudget] = useState(false);
  const [budgetCat, setBudgetCat]   = useState('');
  const [budgetAmt, setBudgetAmt]   = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [showPlanFact, setShowPlanFact]   = useState(false);

  const [y, m] = viewMonth.split('-').map(Number);
  const changeMonth = d => { const nd = new Date(y, m - 1 + d, 1); setViewMonth(nd.toISOString().slice(0, 7)); };

  const vtx     = transactions.filter(t => t.date?.slice(0, 7) === viewMonth);
  const factTx  = vtx.filter(t => t.plan !== 'plan');
  const planTx  = vtx.filter(t => t.plan === 'plan');

  const catTotals = (txList, type) => {
    const map = {};
    txList.filter(t => t.type === type).forEach(t => { map[t.cat] = (map[t.cat] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const expTotals  = catTotals(factTx, 'expense');
  const incTotals  = catTotals(factTx, 'income');
  const planTotals = catTotals(planTx, 'expense');
  const totalExp   = expTotals.reduce((s, [, v]) => s + v, 0);
  const totalInc   = incTotals.reduce((s, [, v]) => s + v, 0);
  const totalPlan  = planTotals.reduce((s, [, v]) => s + v, 0);

  const handleSetBudget = async () => {
    const a = parseFloat(budgetAmt);
    if (!a || !budgetCat) return;
    const updated = { ...budgets, [budgetCat]: a };
    setBudgets(updated);
    await setDoc(doc(db, 'settings', 'budgets'), updated);
    setBudgetAmt(''); setShowBudget(false);
    showToast('Лимит установлен ✓');
  };

  const deleteBudget = async cat => {
    const updated = { ...budgets }; delete updated[cat];
    setBudgets(updated);
    await setDoc(doc(db, 'settings', 'budgets'), updated);
  };

  const exportExcel = async () => {
    setExportLoading(true);
    try {
      const rows = transactions.map(t => ({
        Дата: t.date, Тип: t.type === 'income' ? 'Доход' : 'Расход',
        ПланФакт: t.plan === 'plan' ? 'План' : 'Факт',
        Сумма: t.amount, Категория: t.cat,
        Карман: POCKETS.find(p => p.key === t.pocket)?.label || t.pocket,
        Комментарий: t.note || '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Транзакции');
      XLSX.writeFile(wb, `MarshallFinance_${viewMonth}.xlsx`);
      showToast('Файл скачан ✓');
    } catch (e) { showToast('Ошибка экспорта', 'error'); }
    setExportLoading(false);
  };

  const CatBar = ({ items, total, color, budgetsMap, factMap }) => (
    items.length === 0
      ? <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Нет данных</div>
      : items.map(([cat, amt]) => {
          const pct = total > 0 ? Math.round(amt / total * 100) : 0;
          const budget = budgetsMap?.[cat];
          const factAmt = factMap?.[cat] || 0;
          const over = budget && factAmt > budget;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{cat} {over ? '⚠️' : ''}</span>
                <span style={{ fontWeight: 500, color: over ? '#ef4444' : '#f1f5f9' }}>{fmt(amt)} <span style={{ color: '#64748b', fontWeight: 400 }}>({pct}%)</span></span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: over ? '#ef4444' : color, borderRadius: 3 }} />
              </div>
              {budget && <div style={{ fontSize: 11, color: over ? '#ef4444' : '#64748b', marginTop: 2 }}>Лимит: {fmtFull(budget)} · {over ? '‼️ Превышен на ' + fmtFull(factAmt - budget) : 'Осталось ' + fmtFull(budget - factAmt)}</div>}
            </div>
          );
        })
  );

  const factExpMap = Object.fromEntries(expTotals);

  return (
    <div>
      <div style={{ padding: '20px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 600 }}>Аналитика</span>
        <button onClick={exportExcel} disabled={exportLoading} style={{ ...S.btn('ghost'), padding: '8px 14px', fontSize: 13 }}>
          {exportLoading ? '...' : '📥 Excel'}
        </button>
      </div>

      <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <button onClick={() => changeMonth(-1)} style={{ ...S.btn('ghost'), padding: '8px 14px' }}>‹</button>
        <span style={{ fontWeight: 500 }}>{MONTHS_RU[m - 1]} {y}</span>
        <button onClick={() => changeMonth(1)} style={{ ...S.btn('ghost'), padding: '8px 14px' }}>›</button>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Plan vs Fact summary */}
        <div style={S.card}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>📋 План vs ✅ Факт (расходы)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#60a5fa' }}>📋 Запланировано</span>
            <span style={{ fontWeight: 600, color: '#60a5fa' }}>{fmt(totalPlan)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#ef4444' }}>✅ Потрачено</span>
            <span style={{ fontWeight: 600, color: '#ef4444' }}>{fmt(totalExp)}</span>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Разница</span>
            <span style={{ fontWeight: 600, color: totalPlan - totalExp >= 0 ? '#10b981' : '#ef4444' }}>{fmt(totalPlan - totalExp)}</span>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Фактические расходы</div>
          <CatBar items={expTotals} total={totalExp} color="#3b82f6" budgetsMap={budgets} factMap={factExpMap} />
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Плановые расходы</div>
          <CatBar items={planTotals} total={totalPlan} color="#60a5fa" />
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Доходы по категориям</div>
          <CatBar items={incTotals} total={totalInc} color="#10b981" />
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Бюджетные лимиты</div>
            <button onClick={() => { setBudgetCat(expenseCats[0]?.label || ''); setShowBudget(true); }} style={{ ...S.btn('ghost'), padding: '6px 12px', fontSize: 13 }}>+ Добавить</button>
          </div>
          {Object.keys(budgets).length === 0
            ? <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Лимиты не установлены</div>
            : Object.entries(budgets).map(([cat, limit]) => {
                const spent = factTx.filter(t => t.type === 'expense' && t.cat === cat).reduce((s, t) => s + t.amount, 0);
                const pct = Math.min(Math.round(spent / limit * 100), 100);
                const over = spent > limit;
                return (
                  <div key={cat} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{cat}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: over ? '#ef4444' : '#94a3b8' }}>{fmtFull(spent)} / {fmtFull(limit)}</span>
                        <button onClick={() => deleteBudget(cat)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>×</button>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: over ? '#ef4444' : '#10b981', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      <Modal open={showBudget} onClose={() => setShowBudget(false)} title="Установить лимит">
        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Категория</div>
          <select style={S.select} value={budgetCat} onChange={e => setBudgetCat(e.target.value)}>
            {expenseCats.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={S.label}>Лимит в месяц (₽)</div>
          <input style={S.input} type="number" placeholder="0" value={budgetAmt} onChange={e => setBudgetAmt(e.target.value)} inputMode="numeric" />
        </div>
        <button onClick={handleSetBudget} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center' }}>Сохранить</button>
      </Modal>
    </div>
  );
}

// ── Goals ─────────────────────────────────────────────────────────────────────
function Goals({ goals, setGoals, pockets, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState('');
  const [target, setTarget]     = useState('');
  const [current, setCurrent]   = useState('');
  const [icon, setIcon]         = useState('🎯');
  const [editId, setEditId]     = useState(null);
  const ICONS = ['🎯','🚗','✈️','🏠','📱','💍','🏖️','📚','💪','🐕'];
  const total = Object.values(pockets).reduce((s, v) => s + v, 0);

  const saveGoal = async () => {
    if (!name || !target) return alert('Введи название и цель');
    const id = editId || Date.now().toString();
    const updated = { ...goals, [id]: { name, target: parseFloat(target), current: parseFloat(current) || 0, icon } };
    setGoals(updated);
    await setDoc(doc(db, 'settings', 'goals'), updated);
    setShowForm(false); setName(''); setTarget(''); setCurrent(''); setEditId(null);
    showToast('Цель сохранена ✓');
  };

  const deleteGoal = async id => {
    const updated = { ...goals }; delete updated[id];
    setGoals(updated);
    await setDoc(doc(db, 'settings', 'goals'), updated);
  };

  return (
    <div>
      <div style={{ padding: '20px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 22, fontWeight: 600 }}>Цели</span>
        <button onClick={() => { setEditId(null); setName(''); setTarget(''); setCurrent(''); setShowForm(true); }} style={{ ...S.btn('primary'), padding: '10px 18px', fontSize: 22, lineHeight: 1 }}>+</button>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <div style={S.card}>
          <div style={S.label}>Доступно во всех карманах</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#10b981' }}>{fmtFull(total)}</div>
        </div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {Object.keys(goals).length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ color: '#64748b', fontSize: 14 }}>Добавь первую цель накоплений</div>
          </div>
        ) : Object.entries(goals).map(([id, g]) => {
          const pct = Math.min(Math.round(g.current / g.target * 100), 100);
          return (
            <div key={id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 32 }}>{g.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Цель: {fmtFull(g.target)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setEditId(id); setName(g.name); setTarget(g.target); setCurrent(g.current); setIcon(g.icon); setShowForm(true); }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer' }}>✏️</button>
                  <button onClick={() => deleteGoal(id)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer' }}>×</button>
                </div>
              </div>
              <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: pct + '%', background: pct >= 100 ? '#10b981' : '#3b82f6', borderRadius: 5 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#10b981', fontWeight: 500 }}>{fmtFull(g.current)} накоплено</span>
                <span style={{ color: '#64748b' }}>{pct >= 100 ? '✅ Достигнуто!' : `осталось ${fmtFull(g.target - g.current)}`}</span>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Редактировать цель' : 'Новая цель'}>
        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Иконка</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ICONS.map(i => (
              <button key={i} onClick={() => setIcon(i)} style={{ fontSize: 24, background: icon === i ? '#1e3a5f' : 'rgba(255,255,255,0.06)', border: icon === i ? '1px solid #3b82f6' : '1px solid transparent', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>{i}</button>
            ))}
          </div>
        </div>
        {[['Название', <input style={S.input} type="text" placeholder="Новая машина" value={name} onChange={e => setName(e.target.value)} />],
          ['Сумма цели (₽)', <input style={S.input} type="number" placeholder="0" value={target} onChange={e => setTarget(e.target.value)} inputMode="numeric" />],
          ['Уже накоплено (₽)', <input style={S.input} type="number" placeholder="0" value={current} onChange={e => setCurrent(e.target.value)} inputMode="numeric" />],
        ].map(([lbl, el]) => (
          <div key={lbl} style={{ marginBottom: 12 }}><div style={S.label}>{lbl}</div>{el}</div>
        ))}
        <button onClick={saveGoal} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center', marginTop: 8 }}>Сохранить</button>
      </Modal>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function Settings({ pockets, setPockets, expenseCats, incomeCats, setExpenseCats, setIncomeCats, transactions, onImportSheets, showToast }) {
  const [tab, setTab]         = useState('pockets');
  const [editing, setEditing] = useState(null);
  const [val, setVal]         = useState('');
  const [newCat, setNewCat]   = useState('');
  const [newIcon, setNewIcon] = useState('📌');
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [apiKey, setApiKey]   = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const ICONS_LIST = ['📌','🛒','☕','🚗','🏠','💡','👗','💊','🎬','👶','📱','📦','🚚','🏭','🔄','📣','💻','👥','💰','🛍️','💳','↩️','➕'];
  const total = Object.values(pockets).reduce((s, v) => s + v, 0);

  const savePocket = async key => {
    const v = parseFloat(val); if (isNaN(v)) return;
    const updated = { ...pockets, [key]: v };
    setPockets(updated);
    await setDoc(doc(db, 'settings', 'pockets'), updated);
    setEditing(null); showToast('Сохранено ✓');
  };

  const addCat = async type => {
    if (!newCat.trim()) return;
    const newEntry = { label: newCat.trim(), icon: newIcon };
    if (type === 'expense') {
      const updated = [...expenseCats, newEntry]; setExpenseCats(updated);
      await setDoc(doc(db, 'settings', 'expenseCats'), { cats: updated });
    } else {
      const updated = [...incomeCats, newEntry]; setIncomeCats(updated);
      await setDoc(doc(db, 'settings', 'incomeCats'), { cats: updated });
    }
    setNewCat(''); setNewIcon('📌'); showToast('Категория добавлена ✓');
  };

  const deleteCat = async (type, label) => {
    if (type === 'expense') {
      const updated = expenseCats.filter(c => c.label !== label); setExpenseCats(updated);
      await setDoc(doc(db, 'settings', 'expenseCats'), { cats: updated });
    } else {
      const updated = incomeCats.filter(c => c.label !== label); setIncomeCats(updated);
      await setDoc(doc(db, 'settings', 'incomeCats'), { cats: updated });
    }
  };

  const importFromSheets = async () => {
    if (!apiKey) { setShowApiModal(true); return; }
    setSheetsLoading(true);
    try { await onImportSheets(apiKey); showToast('Импорт завершён ✓'); }
    catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
    setSheetsLoading(false);
  };

  return (
    <div>
      <div style={{ padding: '20px 16px 0', marginBottom: 16 }}>
        <span style={{ fontSize: 22, fontWeight: 600 }}>Настройки</span>
      </div>
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['pockets','Карманы'],['cats','Категории'],['sheets','Google Sheets']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...S.btn(tab === k ? 'primary' : 'ghost'), padding: '8px 14px', fontSize: 13 }}>{l}</button>
        ))}
      </div>
      <div style={{ padding: '0 16px' }}>
        {tab === 'pockets' && (
          <>
            <div style={{ ...S.card, marginBottom: 12 }}>
              <div style={S.label}>Итого</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{fmtFull(total)}</div>
            </div>
            {POCKETS.map(p => (
              <div key={p.key} style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: p.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{p.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{p.label}</div>
                    {editing === p.key ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input style={{ ...S.input, flex: 1 }} type="number" value={val} onChange={e => setVal(e.target.value)} inputMode="numeric" autoFocus />
                        <button onClick={() => savePocket(p.key)} style={{ ...S.btn('primary'), padding: '10px 16px' }}>✓</button>
                        <button onClick={() => setEditing(null)} style={{ ...S.btn('ghost'), padding: '10px 12px' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color: p.color }}>{fmtFull(pockets[p.key] || 0)}</div>
                        <button onClick={() => { setEditing(p.key); setVal(pockets[p.key] || 0); }} style={{ ...S.btn('ghost'), padding: '6px 12px', fontSize: 13, color: '#64748b' }}>Изменить</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {tab === 'cats' && (
          <>
            {[['expense', expenseCats, 'Категории расходов'], ['income', incomeCats, 'Категории доходов']].map(([type, cats, title]) => (
              <div key={type} style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{title}</div>
                {cats.map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: 14 }}>{c.icon} {c.label}</span>
                    <button onClick={() => deleteCat(type, c.label)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
                <div style={{ marginTop: 14 }}>
                  <div style={S.label}>Добавить</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    {ICONS_LIST.map(i => (
                      <button key={i} onClick={() => setNewIcon(i)} style={{ fontSize: 16, background: newIcon === i ? '#1e3a5f' : 'rgba(255,255,255,0.06)', border: newIcon === i ? '1px solid #3b82f6' : '1px solid transparent', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>{i}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...S.input, flex: 1 }} type="text" placeholder="Название" value={newCat} onChange={e => setNewCat(e.target.value)} />
                    <button onClick={() => addCat(type)} style={{ ...S.btn('primary'), padding: '12px 16px', whiteSpace: 'nowrap' }}>+ Добавить</button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {tab === 'sheets' && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>📊 Импорт из Google Sheets ДДС</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 16 }}>Импортирует транзакции из листа "Проводки" твоей ДДС таблицы.</div>
            {!apiKey ? (
              <button onClick={() => setShowApiModal(true)} style={{ ...S.btn('ghost'), width: '100%', textAlign: 'center', marginBottom: 8 }}>Ввести API ключ</button>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: '#10b981', marginBottom: 12 }}>✓ API ключ сохранён</div>
                <button onClick={importFromSheets} disabled={sheetsLoading} style={{ ...S.btn('green'), width: '100%', textAlign: 'center', marginBottom: 8 }}>
                  {sheetsLoading ? '⏳ Импортирую...' : '📥 Импортировать из ДДС'}
                </button>
                <button onClick={() => setApiKey('')} style={{ ...S.btn('ghost'), width: '100%', textAlign: 'center', fontSize: 13 }}>Сменить API ключ</button>
              </div>
            )}
          </div>
        )}
      </div>
      <Modal open={showApiModal} onClose={() => setShowApiModal(false)} title="Google API ключ">
        <div style={{ marginBottom: 16 }}>
          <div style={S.label}>API ключ</div>
          <input style={S.input} type="text" placeholder="AIzaSy..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </div>
        <button onClick={() => setShowApiModal(false)} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center' }}>Сохранить</button>
      </Modal>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [pockets, setPockets]       = useState({ personal: 0, business: 0, cash: 0, invest: 0 });
  const [budgets, setBudgets]       = useState({});
  const [goals, setGoals]           = useState({});
  const [expenseCats, setExpenseCats] = useState(DEFAULT_EXPENSE_CATS);
  const [incomeCats, setIncomeCats]   = useState(DEFAULT_INCOME_CATS);
  const [viewMonth, setViewMonth]   = useState(nowMonth());
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState({ msg: '', type: 'success' });
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [ps, bs, gs, ec, ic] = await Promise.all(['pockets','budgets','goals','expenseCats','incomeCats'].map(k => getDoc(doc(db, 'settings', k))));
        if (ps.exists()) setPockets(ps.data());
        if (bs.exists()) setBudgets(bs.data());
        if (gs.exists()) setGoals(gs.data());
        if (ec.exists() && ec.data().cats) setExpenseCats(ec.data().cats);
        if (ic.exists() && ic.data().cats) setIncomeCats(ic.data().cats);
      } catch(e) { console.error(e); }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'transactions'), snap => {
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
    if (tx.pocket === 'business') { 
      fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tx, id }),
      }).catch(() => {});
    }
  }, []);

  const deleteTransaction = useCallback(async id => {
    const tx = transactions.find(t => t.id === String(id));
    if (tx && tx.pocket === 'business' && !tx.fromSheets) {
      fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: String(id) }),
      }).catch(() => {});
    }
    await deleteDoc(doc(db, 'transactions', String(id)));
  }, [transactions]);

  const editTransaction = useCallback(async (id, updates) => {
    const tx = transactions.find(t => t.id === String(id));
    await updateDoc(doc(db, 'transactions', String(id)), updates);
    if (tx && tx.pocket === 'business' && !tx.fromSheets) {
      fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: String(id), plan: updates.plan || tx.plan }),
      }).catch(() => {});
    }
    showToast('Изменено ✓');
  }, [transactions]);

  const transferPockets = useCallback(async (fromKey, toKey, amount) => {
    const updated = { ...pockets, [fromKey]: (pockets[fromKey] || 0) - amount, [toKey]: (pockets[toKey] || 0) + amount };
    setPockets(updated);
    await setDoc(doc(db, 'settings', 'pockets'), updated);
    const id = Date.now().toString();
    const fromLabel = POCKETS.find(p => p.key === fromKey)?.label || fromKey;
    const toLabel   = POCKETS.find(p => p.key === toKey)?.label   || toKey;
    await setDoc(doc(db, 'transactions', id), {
      id, type: 'transfer', amount, pocket: fromKey, toPocket: toKey,
      cat: `Перевод: ${fromLabel} → ${toLabel}`, date: todayStr(), note: '', createdAt: new Date().toISOString(),
    });
  }, [pockets]);

  const importFromSheets = useCallback(async (apiKey) => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/%D0%9F%D1%80%D0%BE%D0%B2%D0%BE%D0%B4%D0%BA%D0%B8!A2:G2000?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Ошибка доступа к таблице');
    const data = await res.json();
    const rows = data.values || [];
    let count = 0;
    for (const row of rows) {
      const [dateRaw, sumRaw, cat, typeRaw, , comment] = row;
      if (!dateRaw || !sumRaw || !cat) continue;
      const parts = dateRaw.split('.');
      const date = parts.length === 2 ? `2026-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}` : dateRaw;
      const amount = parseFloat(String(sumRaw).replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!amount) continue;
      const type = typeRaw?.toLowerCase().includes('поступ') ? 'income' : 'expense';
      const id = `sheets_${dateRaw}_${amount}_${cat}`.replace(/\s/g, '_');
      if (transactions.find(t => t.id === id)) continue;
      await setDoc(doc(db, 'transactions', id), { id, type, amount, cat, pocket: 'business', date, note: comment || '', fromSheets: true, plan: 'fact', createdAt: new Date().toISOString() });
      count++;
    }
    if (count === 0) showToast('Новых записей нет', 'warn');
    else showToast(`Импортировано ${count} записей ✓`);
  }, [transactions]);

  const allCats = [...expenseCats, ...incomeCats];

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #334155', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ color: '#64748b', fontSize: 14 }}>Загрузка MarshallFinance...</div>
    </div>
  );

  const TABS = [
    { key: 'overview',     label: 'Обзор',     icon: '◉' },
    { key: 'transactions', label: 'Операции',  icon: '⇅' },
    { key: 'analytics',   label: 'Аналитика', icon: '▦' },
    { key: 'goals',       label: 'Цели',      icon: '🎯' },
    { key: 'settings',    label: 'Настройки', icon: '⚙' },
  ];

  return (
    <div style={S.app}>
      <Toast msg={toast.msg} type={toast.type} />
      {tab === 'overview'     && <Overview     pockets={pockets} transactions={transactions} budgets={budgets} viewMonth={viewMonth} setViewMonth={setViewMonth} allCats={allCats} />}
      {tab === 'transactions' && <Transactions transactions={transactions} onAdd={addTransaction} onDelete={deleteTransaction} onEdit={editTransaction} onTransfer={transferPockets} expenseCats={expenseCats} incomeCats={incomeCats} allCats={allCats} showToast={showToast} />}
      {tab === 'analytics'   && <Analytics    transactions={transactions} budgets={budgets} setBudgets={setBudgets} viewMonth={viewMonth} setViewMonth={setViewMonth} expenseCats={expenseCats} showToast={showToast} />}
      {tab === 'goals'       && <Goals        goals={goals} setGoals={setGoals} pockets={pockets} showToast={showToast} />}
      {tab === 'settings'    && <Settings     pockets={pockets} setPockets={setPockets} expenseCats={expenseCats} incomeCats={incomeCats} setExpenseCats={setExpenseCats} setIncomeCats={setIncomeCats} transactions={transactions} onImportSheets={importFromSheets} showToast={showToast} />}
      <nav style={S.bottomNav}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={S.navBtn(tab === t.key)}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
