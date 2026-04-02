import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';

// ────────────────────────────────────────────────────────────────────────────
// DATA — Audited financial statements, Cloudskraal Boerdery (Pty) Ltd, YE 28 Feb
// ────────────────────────────────────────────────────────────────────────────

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

const INCOME_STATEMENT = {
  revenue: [4_956_000, 3_654_000, 2_798_000, 3_268_000, 5_637_391, 6_671_990],
  otherIncome: [0, 0, 0, 0, 501_250, 559_638],
  expenses: {
    purchases: [0, 0, 0, 0, 800_339, 628_858],
    openingStock: [0, 0, 0, 0, 501_250, 501_250],
    fertilizer: [0, 0, 0, 0, 483_957, 531_593],
    fuel: [0, 0, 0, 0, 561_153, 698_204],
    depreciation: [0, 0, 0, 0, 669_026, 460_100],
    directorFees: [0, 0, 0, 0, 240_000, 240_000],
    electricity: [0, 0, 0, 0, 194_011, 179_095],
    repairs: [0, 0, 0, 0, 684_776, 1_836_477],
    rent: [0, 0, 0, 0, 173_375, 174_696],
    harvestCosts: [0, 0, 0, 0, 266_252, 277_104],
    seed: [0, 0, 0, 0, 70_200, 70_200],
    transport: [0, 0, 0, 0, 107_323, 258_726],
    insurance: [0, 0, 0, 0, 217_802, 261_875],
    employeeCosts: [0, 0, 0, 0, 1_037_538, 945_600],
  },
  totalExpenses: [4_632_000, 4_327_000, 4_530_000, 4_684_000, 6_674_349, 7_290_437],
  operatingProfit: [324_000, -673_000, -1_732_000, -1_416_000, -535_708, -58_809],
  investmentIncome: [2_625_000, 2_686_000, 2_717_000, 2_192_000, 2_223_945, 2_356_266],
  financeCosts: [-505_000, -423_000, -510_000, -776_000, -1_040_215, -896_312],
  profitBeforeTax: [2_444_000, 1_590_000, 475_000, 0, 648_022, 1_401_145],
  tax: [-1_960_000, -709_000, 0, 0, 0, -76_230],
  netProfit: [484_000, 881_000, 475_000, -1_182_000, 648_022, 1_324_915],
};

const BALANCE_SHEET = {
  assets: {
    ppe: [3_171_000, 2_179_000, 6_185_000, 8_961_000, 8_192_408, 8_890_134],
    loansReceivable: [32_256_000, 33_601_000, 33_860_000, 25_178_000, 28_588_031, 25_492_901],
    investments: [712_000, 712_000, 0, 2_400_000, 632_368, 484_934],
    stock: [0, 0, 0, 0, 501_250, 501_250],
    debtors: [0, 0, 0, 0, 214_736, 836_295],
    cash: [852_000, 1_802_000, 521_000, 112_000, 48_265, 66_310],
  },
  totalAssets: [36_991_000, 38_294_000, 40_566_000, 37_651_000, 38_177_058, 36_271_824],
  equity: {
    shareCapital: [100, 100, 100, 100, 100, 100],
    retainedEarnings: [30_874_000, 30_710_000, 29_528_000, 26_602_000, 27_249_904, 28_574_819],
  },
  totalEquity: [30_874_000, 30_710_000, 29_528_000, 26_602_000, 27_250_004, 28_574_919],
  liabilities: {
    loansPayable: [1_590_000, 2_088_000, 6_411_000, 6_157_000, 9_597_825, 6_319_510],
    creditors: [4_527_000, 4_935_000, 4_590_000, 4_892_000, 1_329_229, 1_301_165],
    taxPayable: [0, 0, 0, 0, 0, 76_230],
  },
  totalLiabilities: [6_117_000, 7_584_000, 11_038_000, 11_049_000, 10_927_054, 7_696_905],
};

const ENTERPRISE_REVENUE = {
  years: [2024, 2025],
  rooibos: [2_397_473, 6_142_194],
  wineGrapes: [1_473_920, 2_039_981],
  sheepWool: [459_039, 1_579_301],
  other: [22_800, 418_863],
};

const LOAN_DETAILS = [
  { counterparty: 'JAL Nel (Owed to Cloudskraal)', principal: 23_950_000, rate: 0.08, interest: 2_160_000 },
  { counterparty: 'F Nel (Owed to Cloudskraal)', principal: 1_540_000, rate: 0.08, interest: 125_000 },
  { counterparty: 'Cloudskraal Winery (Owed by Cloudskraal)', principal: -2_080_000, rate: 0.08, interest: -166_000 },
  { counterparty: 'Alexenya (Owed by Cloudskraal)', principal: -4_230_000, rate: 0.08, interest: -338_000 },
  { counterparty: 'ABSA (Owed by Cloudskraal)', principal: -13_000, rate: 0, interest: 0 },
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function fmtZAR(val: number): string {
  if (val === 0) return '\u2014';
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return val < 0 ? `(R${formatted})` : `R${formatted}`;
}

function fmtPct(val: number | null): string {
  if (val == null || !isFinite(val)) return '\u2014';
  return `${val.toFixed(1)}%`;
}

function fmtCurrencyShort(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `R${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `R${(val / 1_000).toFixed(0)}K`;
  return `R${val.toLocaleString('en-ZA')}`;
}

function yoyArrow(curr: number, prev: number, higherIsGood: boolean): React.ReactNode {
  if (prev === 0 && curr === 0) return null;
  const improved = higherIsGood ? curr > prev : curr < prev;
  const equal = curr === prev;
  if (equal) return null;
  return (
    <span className={`text-[10px] ml-1 ${improved ? 'text-emerald-600' : 'text-red-500'}`}>
      {improved ? '\u25B2' : '\u25BC'}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

type Tab = 'income' | 'balance' | 'cashflow' | 'ratios';

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'income', label: 'Income Statement' },
  { key: 'balance', label: 'Balance Sheet' },
  { key: 'cashflow', label: 'Cash Flow' },
  { key: 'ratios', label: 'Key Ratios' },
];

// Shared table header row
function YearHeaders() {
  return (
    <tr className="border-b-2 border-stone-300">
      <th className="text-left py-2 pr-4 text-xs font-semibold text-stone-600 sticky left-0 bg-white min-w-[180px]">
        R&apos;000
      </th>
      {YEARS.map((y, i) => (
        <th
          key={y}
          className={`text-right py-2 px-3 text-xs font-semibold min-w-[100px] ${
            i === YEARS.length - 1 ? 'bg-emerald-50/60 text-emerald-800' : 'text-stone-600'
          }`}
        >
          FY{y}
        </th>
      ))}
    </tr>
  );
}

interface RowProps {
  label: string;
  values: number[];
  bold?: boolean;
  indent?: boolean;
  isRevenue?: boolean;
  higherIsGood?: boolean;
  borderTop?: boolean;
  borderBottom?: boolean;
}

function StatementRow({ label, values, bold, indent, isRevenue, higherIsGood = true, borderTop, borderBottom }: RowProps) {
  return (
    <tr
      className={`${borderTop ? 'border-t border-stone-300' : ''} ${borderBottom ? 'border-b border-stone-300' : ''} hover:bg-stone-50/50`}
    >
      <td
        className={`py-1.5 pr-4 text-xs sticky left-0 bg-white ${indent ? 'pl-5' : 'pl-0'} ${
          bold ? 'font-bold text-stone-900' : 'text-stone-700'
        }`}
      >
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`text-right py-1.5 px-3 text-xs font-mono tabular-nums ${
            i === YEARS.length - 1 ? 'bg-emerald-50/60' : ''
          } ${v < 0 ? 'text-red-600' : isRevenue && v > 0 ? 'text-emerald-700' : 'text-stone-800'} ${
            bold ? 'font-bold' : ''
          }`}
        >
          {fmtZAR(v)}
          {i > 0 && yoyArrow(v, values[i - 1], higherIsGood)}
        </td>
      ))}
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Income Statement Tab
// ────────────────────────────────────────────────────────────────────────────

function IncomeStatementTab() {
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const IS = INCOME_STATEMENT;

  const expenseLabels: { key: keyof typeof IS.expenses; label: string }[] = [
    { key: 'purchases', label: 'Purchases' },
    { key: 'openingStock', label: 'Opening Stock' },
    { key: 'fertilizer', label: 'Fertilizer' },
    { key: 'fuel', label: 'Fuel' },
    { key: 'depreciation', label: 'Depreciation' },
    { key: 'directorFees', label: 'Director Fees' },
    { key: 'electricity', label: 'Electricity' },
    { key: 'repairs', label: 'Repairs & Maintenance' },
    { key: 'rent', label: 'Rent' },
    { key: 'harvestCosts', label: 'Harvest Costs' },
    { key: 'seed', label: 'Seed' },
    { key: 'transport', label: 'Transport' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'employeeCosts', label: 'Employee Costs' },
  ];

  // Enterprise revenue section
  const enterpriseYearIndices = ENTERPRISE_REVENUE.years.map((y) => YEARS.indexOf(y));

  function enterpriseRow(label: string, data: number[]) {
    const full = YEARS.map((_, i) => {
      const eIdx = enterpriseYearIndices.indexOf(i);
      return eIdx >= 0 ? data[eIdx] : 0;
    });
    return <StatementRow label={label} values={full} indent isRevenue />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <YearHeaders />
        </thead>
        <tbody>
          {/* Revenue */}
          <StatementRow label="Revenue" values={IS.revenue} bold isRevenue />
          {enterpriseRow('Rooibos', ENTERPRISE_REVENUE.rooibos)}
          {enterpriseRow('Wine Grapes', ENTERPRISE_REVENUE.wineGrapes)}
          {enterpriseRow('Sheep & Wool', ENTERPRISE_REVENUE.sheepWool)}
          {enterpriseRow('Other', ENTERPRISE_REVENUE.other)}

          <StatementRow label="Other Income" values={IS.otherIncome} indent />

          {/* Expenses */}
          <tr>
            <td
              className="py-1.5 pr-4 text-xs font-bold text-stone-900 sticky left-0 bg-white cursor-pointer select-none"
              onClick={() => setShowExpenseDetail(!showExpenseDetail)}
            >
              Total Expenses {showExpenseDetail ? '▾' : '▸'}
            </td>
            {IS.totalExpenses.map((v, i) => (
              <td
                key={i}
                className={`text-right py-1.5 px-3 text-xs font-mono tabular-nums font-bold text-stone-800 ${
                  i === YEARS.length - 1 ? 'bg-emerald-50/60' : ''
                }`}
              >
                {fmtZAR(v)}
                {i > 0 && yoyArrow(v, IS.totalExpenses[i - 1], false)}
              </td>
            ))}
          </tr>

          {showExpenseDetail &&
            expenseLabels.map(({ key, label }) => (
              <StatementRow key={key} label={label} values={IS.expenses[key]} indent higherIsGood={false} />
            ))}

          {/* Operating profit */}
          <StatementRow label="Operating Profit" values={IS.operatingProfit} bold borderTop />
          <StatementRow label="Investment Income" values={IS.investmentIncome} indent isRevenue />
          <StatementRow label="Finance Costs" values={IS.financeCosts} indent higherIsGood={false} />
          <StatementRow label="Profit Before Tax" values={IS.profitBeforeTax} bold borderTop />
          <StatementRow label="Tax" values={IS.tax} indent higherIsGood={false} />
          <StatementRow label="Net Profit" values={IS.netProfit} bold borderTop borderBottom />
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Balance Sheet Tab
// ────────────────────────────────────────────────────────────────────────────

function BalanceSheetTab() {
  const BS = BALANCE_SHEET;

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <YearHeaders />
          </thead>
          <tbody>
            {/* Assets */}
            <tr>
              <td colSpan={YEARS.length + 1} className="pt-3 pb-1 text-xs font-bold text-stone-500 uppercase tracking-wide">
                Assets
              </td>
            </tr>
            <StatementRow label="Property, Plant & Equipment" values={BS.assets.ppe} indent />
            <StatementRow label="Loans Receivable" values={BS.assets.loansReceivable} indent />
            <StatementRow label="Investments" values={BS.assets.investments} indent />
            <StatementRow label="Inventory" values={BS.assets.stock} indent />
            <StatementRow label="Trade Debtors" values={BS.assets.debtors} indent />
            <StatementRow label="Cash & Equivalents" values={BS.assets.cash} indent />
            <StatementRow label="Total Assets" values={BS.totalAssets} bold borderTop />

            {/* Equity */}
            <tr>
              <td colSpan={YEARS.length + 1} className="pt-4 pb-1 text-xs font-bold text-stone-500 uppercase tracking-wide">
                Equity
              </td>
            </tr>
            <StatementRow label="Share Capital" values={BS.equity.shareCapital} indent />
            <StatementRow label="Retained Earnings" values={BS.equity.retainedEarnings} indent />
            <StatementRow label="Total Equity" values={BS.totalEquity} bold borderTop />

            {/* Liabilities */}
            <tr>
              <td colSpan={YEARS.length + 1} className="pt-4 pb-1 text-xs font-bold text-stone-500 uppercase tracking-wide">
                Liabilities
              </td>
            </tr>
            <StatementRow label="Loans Payable" values={BS.liabilities.loansPayable} indent higherIsGood={false} />
            <StatementRow label="Trade Creditors" values={BS.liabilities.creditors} indent higherIsGood={false} />
            <StatementRow label="Tax Payable" values={BS.liabilities.taxPayable} indent higherIsGood={false} />
            <StatementRow label="Total Liabilities" values={BS.totalLiabilities} bold borderTop higherIsGood={false} />

            {/* Check line */}
            <StatementRow
              label="Total Equity + Liabilities"
              values={YEARS.map((_, i) => BS.totalEquity[i] + BS.totalLiabilities[i])}
              bold
              borderTop
              borderBottom
            />
          </tbody>
        </table>
      </div>

      {/* Loan Detail */}
      <div>
        <h3 className="text-sm font-bold text-stone-800 mb-2">Intercompany Loan Structure</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-300">
                <th className="text-left py-2 pr-4 font-semibold text-stone-600">Counterparty</th>
                <th className="text-right py-2 px-3 font-semibold text-stone-600">Principal</th>
                <th className="text-right py-2 px-3 font-semibold text-stone-600">Rate</th>
                <th className="text-right py-2 px-3 font-semibold text-stone-600">Annual Interest</th>
              </tr>
            </thead>
            <tbody>
              {LOAN_DETAILS.map((loan) => (
                <tr key={loan.counterparty} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="py-1.5 pr-4 text-stone-700">{loan.counterparty}</td>
                  <td className={`text-right py-1.5 px-3 font-mono tabular-nums ${loan.principal < 0 ? 'text-red-600' : 'text-stone-800'}`}>
                    {fmtZAR(loan.principal)}
                  </td>
                  <td className="text-right py-1.5 px-3 text-stone-600">{loan.rate > 0 ? fmtPct(loan.rate * 100) : '\u2014'}</td>
                  <td className={`text-right py-1.5 px-3 font-mono tabular-nums ${loan.interest < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {fmtZAR(loan.interest)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-stone-300 font-bold">
                <td className="py-1.5 pr-4 text-stone-900">Net Position</td>
                <td className="text-right py-1.5 px-3 font-mono tabular-nums text-emerald-700">
                  {fmtZAR(LOAN_DETAILS.reduce((s, l) => s + l.principal, 0))}
                </td>
                <td />
                <td className="text-right py-1.5 px-3 font-mono tabular-nums text-emerald-700">
                  {fmtZAR(LOAN_DETAILS.reduce((s, l) => s + l.interest, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cash Flow Tab (derived)
// ────────────────────────────────────────────────────────────────────────────

function CashFlowTab() {
  const IS = INCOME_STATEMENT;
  const BS = BALANCE_SHEET;

  // Derive cash flow for years 1..5 (need prior year for deltas)
  const cfData = useMemo(() => {
    const rows = [];
    for (let i = 1; i < YEARS.length; i++) {
      const depreciation = IS.expenses.depreciation[i];
      const dStock = -(BS.assets.stock[i] - BS.assets.stock[i - 1]);
      const dDebtors = -(BS.assets.debtors[i] - BS.assets.debtors[i - 1]);
      const dCreditors = BS.liabilities.creditors[i] - BS.liabilities.creditors[i - 1];
      const dTax = BS.liabilities.taxPayable[i] - BS.liabilities.taxPayable[i - 1];
      const workingCapital = dStock + dDebtors + dCreditors + dTax;
      const operating = IS.netProfit[i] + depreciation + workingCapital;

      const dPPE = -(BS.assets.ppe[i] - BS.assets.ppe[i - 1]);
      const dInvestments = -(BS.assets.investments[i] - BS.assets.investments[i - 1]);
      const dLoansRec = -(BS.assets.loansReceivable[i] - BS.assets.loansReceivable[i - 1]);
      const investing = dPPE + dInvestments + dLoansRec;

      const dLoansPayable = BS.liabilities.loansPayable[i] - BS.liabilities.loansPayable[i - 1];
      const dEquity = (BS.totalEquity[i] - BS.totalEquity[i - 1]) - IS.netProfit[i]; // equity changes excl profit
      const financing = dLoansPayable + dEquity;

      const netChange = operating + investing + financing;
      const openCash = BS.assets.cash[i - 1];
      const closeCash = BS.assets.cash[i];

      rows.push({
        year: YEARS[i],
        netProfit: IS.netProfit[i],
        depreciation,
        workingCapital,
        operating,
        dPPE,
        dInvestments,
        dLoansRec,
        investing,
        dLoansPayable,
        dEquity,
        financing,
        netChange,
        openCash,
        closeCash,
      });
    }
    return rows;
  }, []);

  const cfYears = cfData.map((r) => r.year);
  const val = (field: keyof (typeof cfData)[0]) => cfData.map((r) => r[field] as number);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-stone-300">
            <th className="text-left py-2 pr-4 text-xs font-semibold text-stone-600 sticky left-0 bg-white min-w-[200px]">
              R&apos;000
            </th>
            {cfYears.map((y, i) => (
              <th
                key={y}
                className={`text-right py-2 px-3 text-xs font-semibold min-w-[100px] ${
                  i === cfYears.length - 1 ? 'bg-emerald-50/60 text-emerald-800' : 'text-stone-600'
                }`}
              >
                FY{y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Operating */}
          <tr>
            <td colSpan={cfYears.length + 1} className="pt-3 pb-1 text-xs font-bold text-stone-500 uppercase tracking-wide">
              Operating Activities
            </td>
          </tr>
          <StatementRowShort label="Net Profit" values={val('netProfit')} years={cfYears} />
          <StatementRowShort label="Add: Depreciation" values={val('depreciation')} years={cfYears} indent />
          <StatementRowShort label="Working Capital Changes" values={val('workingCapital')} years={cfYears} indent />
          <StatementRowShort label="Cash from Operations" values={val('operating')} years={cfYears} bold borderTop />

          {/* Investing */}
          <tr>
            <td colSpan={cfYears.length + 1} className="pt-4 pb-1 text-xs font-bold text-stone-500 uppercase tracking-wide">
              Investing Activities
            </td>
          </tr>
          <StatementRowShort label="PPE (Acquisitions)/Disposals" values={val('dPPE')} years={cfYears} indent />
          <StatementRowShort label="Investments" values={val('dInvestments')} years={cfYears} indent />
          <StatementRowShort label="Loans Receivable" values={val('dLoansRec')} years={cfYears} indent />
          <StatementRowShort label="Cash from Investing" values={val('investing')} years={cfYears} bold borderTop />

          {/* Financing */}
          <tr>
            <td colSpan={cfYears.length + 1} className="pt-4 pb-1 text-xs font-bold text-stone-500 uppercase tracking-wide">
              Financing Activities
            </td>
          </tr>
          <StatementRowShort label="Loans Payable" values={val('dLoansPayable')} years={cfYears} indent />
          <StatementRowShort label="Equity Changes" values={val('dEquity')} years={cfYears} indent />
          <StatementRowShort label="Cash from Financing" values={val('financing')} years={cfYears} bold borderTop />

          {/* Net */}
          <StatementRowShort label="Net Change in Cash" values={val('netChange')} years={cfYears} bold borderTop />
          <StatementRowShort label="Opening Cash" values={val('openCash')} years={cfYears} indent />
          <StatementRowShort label="Closing Cash" values={val('closeCash')} years={cfYears} bold borderBottom />
        </tbody>
      </table>
    </div>
  );
}

// Reusable row for cash-flow (different year set)
function StatementRowShort({
  label,
  values,
  years,
  bold,
  indent,
  borderTop,
  borderBottom,
}: {
  label: string;
  values: number[];
  years: number[];
  bold?: boolean;
  indent?: boolean;
  borderTop?: boolean;
  borderBottom?: boolean;
}) {
  return (
    <tr
      className={`${borderTop ? 'border-t border-stone-300' : ''} ${borderBottom ? 'border-b border-stone-300' : ''} hover:bg-stone-50/50`}
    >
      <td
        className={`py-1.5 pr-4 text-xs sticky left-0 bg-white ${indent ? 'pl-5' : 'pl-0'} ${
          bold ? 'font-bold text-stone-900' : 'text-stone-700'
        }`}
      >
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`text-right py-1.5 px-3 text-xs font-mono tabular-nums ${
            i === years.length - 1 ? 'bg-emerald-50/60' : ''
          } ${v < 0 ? 'text-red-600' : 'text-stone-800'} ${bold ? 'font-bold' : ''}`}
        >
          {fmtZAR(v)}
        </td>
      ))}
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Key Ratios Tab
// ────────────────────────────────────────────────────────────────────────────

function KeyRatiosTab() {
  const IS = INCOME_STATEMENT;
  const BS = BALANCE_SHEET;

  const ratios = useMemo(() => {
    return YEARS.map((y, i) => {
      const rev = IS.revenue[i];
      const grossProfit = rev + IS.otherIncome[i] - IS.totalExpenses[i];
      const grossMargin = rev > 0 ? (grossProfit / rev) * 100 : null;
      const operatingMargin = rev > 0 ? (IS.operatingProfit[i] / rev) * 100 : null;
      const netMargin = rev > 0 ? (IS.netProfit[i] / rev) * 100 : null;
      const roe = BS.totalEquity[i] > 0 ? (IS.netProfit[i] / BS.totalEquity[i]) * 100 : null;
      const roa = BS.totalAssets[i] > 0 ? (IS.netProfit[i] / BS.totalAssets[i]) * 100 : null;
      const debtToEquity = BS.totalEquity[i] > 0 ? BS.totalLiabilities[i] / BS.totalEquity[i] : null;

      // Current ratio: current assets / current liabilities
      const currentAssets = BS.assets.stock[i] + BS.assets.debtors[i] + BS.assets.cash[i];
      const currentLiabilities = BS.liabilities.creditors[i] + BS.liabilities.taxPayable[i];
      const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;

      // Interest coverage
      const ebit = IS.operatingProfit[i] + IS.investmentIncome[i];
      const interestCoverage = IS.financeCosts[i] !== 0 ? ebit / Math.abs(IS.financeCosts[i]) : null;

      return { year: y, grossMargin, operatingMargin, netMargin, roe, roa, debtToEquity, currentRatio, interestCoverage };
    });
  }, []);

  type RatioRow = {
    label: string;
    key: keyof (typeof ratios)[0];
    format: 'pct' | 'ratio';
    higherIsGood: boolean;
  };

  const ratioRows: RatioRow[] = [
    { label: 'Gross Margin', key: 'grossMargin', format: 'pct', higherIsGood: true },
    { label: 'Operating Margin', key: 'operatingMargin', format: 'pct', higherIsGood: true },
    { label: 'Net Margin', key: 'netMargin', format: 'pct', higherIsGood: true },
    { label: 'Return on Equity', key: 'roe', format: 'pct', higherIsGood: true },
    { label: 'Return on Assets', key: 'roa', format: 'pct', higherIsGood: true },
    { label: 'Debt-to-Equity', key: 'debtToEquity', format: 'ratio', higherIsGood: false },
    { label: 'Current Ratio', key: 'currentRatio', format: 'ratio', higherIsGood: true },
    { label: 'Interest Coverage', key: 'interestCoverage', format: 'ratio', higherIsGood: true },
  ];

  // Sparkline data for recharts
  const marginData = ratios.map((r) => ({
    year: `FY${r.year}`,
    'Net Margin': r.netMargin,
    'Operating Margin': r.operatingMargin,
  }));

  const leverageData = ratios.map((r) => ({
    year: `FY${r.year}`,
    'Debt/Equity': r.debtToEquity,
    'Interest Coverage': r.interestCoverage,
  }));

  // Enterprise revenue stacked bar
  const entYears = ENTERPRISE_REVENUE.years;
  const entData = entYears.map((y, i) => ({
    year: `FY${y}`,
    Rooibos: ENTERPRISE_REVENUE.rooibos[i],
    'Wine Grapes': ENTERPRISE_REVENUE.wineGrapes[i],
    'Sheep & Wool': ENTERPRISE_REVENUE.sheepWool[i],
    Other: ENTERPRISE_REVENUE.other[i],
  }));

  return (
    <div className="space-y-8">
      {/* Ratio table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-stone-300">
              <th className="text-left py-2 pr-4 text-xs font-semibold text-stone-600 sticky left-0 bg-white min-w-[180px]">
                Metric
              </th>
              {YEARS.map((y, i) => (
                <th
                  key={y}
                  className={`text-right py-2 px-3 text-xs font-semibold min-w-[90px] ${
                    i === YEARS.length - 1 ? 'bg-emerald-50/60 text-emerald-800' : 'text-stone-600'
                  }`}
                >
                  FY{y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ratioRows.map((row) => (
              <tr key={row.key} className="hover:bg-stone-50/50 border-b border-stone-100">
                <td className="py-1.5 pr-4 text-xs text-stone-700 sticky left-0 bg-white">{row.label}</td>
                {ratios.map((r, i) => {
                  const v = r[row.key] as number | null;
                  const prev = i > 0 ? (ratios[i - 1][row.key] as number | null) : null;
                  return (
                    <td
                      key={i}
                      className={`text-right py-1.5 px-3 text-xs font-mono tabular-nums ${
                        i === YEARS.length - 1 ? 'bg-emerald-50/60' : ''
                      } ${v != null && v < 0 ? 'text-red-600' : 'text-stone-800'}`}
                    >
                      {row.format === 'pct' ? fmtPct(v) : v != null && isFinite(v) ? `${v.toFixed(2)}x` : '\u2014'}
                      {v != null && prev != null && yoyArrow(v, prev, row.higherIsGood)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin trends */}
        <div>
          <h3 className="text-xs font-bold text-stone-700 mb-2 uppercase tracking-wide">Margin Trends</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={marginData}>
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Net Margin" stroke="#047857" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Operating Margin" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leverage */}
        <div>
          <h3 className="text-xs font-bold text-stone-700 mb-2 uppercase tracking-wide">Leverage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={leverageData}>
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}x`} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)}x`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Debt/Equity" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Interest Coverage" stroke="#047857" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by enterprise */}
        <div className="lg:col-span-2">
          <h3 className="text-xs font-bold text-stone-700 mb-2 uppercase tracking-wide">Revenue by Enterprise</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={entData}>
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtCurrencyShort(v)} />
              <Tooltip formatter={(v) => fmtZAR(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Rooibos" stackId="a" fill="#047857" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Wine Grapes" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Sheep & Wool" stackId="a" fill="#d97706" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Other" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export default function ThreeStatementModel() {
  const [activeTab, setActiveTab] = useState<Tab>('income');

  return (
    <div>
      <h2 className="text-sm font-bold text-stone-800 mb-3">Three-Statement Financial Model</h2>
      <p className="text-xs text-stone-500 mb-4">
        Cloudskraal Boerdery (Pty) Ltd — Audited financials, year-end 28 February
      </p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 overflow-x-auto border-b border-stone-200">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'income' && <IncomeStatementTab />}
      {activeTab === 'balance' && <BalanceSheetTab />}
      {activeTab === 'cashflow' && <CashFlowTab />}
      {activeTab === 'ratios' && <KeyRatiosTab />}
    </div>
  );
}
