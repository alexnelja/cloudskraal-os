export interface Employee {
  id: string;
  name: string;
  type: string; // permanent, seasonal, contractor
  department: string | null;
  role: string | null;
  farm_id: string | null;
  farm_name?: string;
  hourly_rate: number | null;
  monthly_salary: number | null;
  start_date: string | null;
  status: string;
  phone: string | null;
  notes: string | null;
  time_entries?: TimeEntry[];
}

export interface TimeEntry {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  activity_type: string | null;
  enterprise: string | null;
  notes: string | null;
}

export interface EmployeeSummary {
  total: number;
  byDepartment: Record<string, number>;
  byType: Record<string, number>;
  totalMonthlyCost: number;
}

export interface InputProduct {
  id: string;
  name: string;
  category: string;
  unit_of_measure: string | null;
  active_ingredients: string | null;
  withholding_period_days: number | null;
  supplier: string | null;
  cost_per_unit: number | null;
  notes: string | null;
  wiki_page_id: string | null;
  stock?: InventoryStock[];
}

export interface InventoryStock {
  id: string;
  product_id: string;
  product_name?: string;
  location: string | null;
  quantity_on_hand: number;
  expiry_date: string | null;
  last_updated: string;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  product_name?: string;
  type: string;
  date: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  notes: string | null;
}

export interface InventorySummary {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  byCategory: Record<string, number>;
}

export interface Enterprise {
  id: string;
  name: string;
  type: string | null;
  entity: string | null;
}

export interface FinancialDashboard {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  byEnterprise: { name: string; revenue: number; expenses: number; net: number }[];
}

export interface FinancialTransaction {
  id: string;
  date: string;
  description: string | null;
  type: string;
  amount: number;
  category: string | null;
  enterprise_id: string | null;
  enterprise_name?: string;
  source_reference: string | null;
}

export const EMPLOYEE_TYPE_COLORS: Record<string, string> = {
  permanent: '#047857',
  seasonal: '#d97706',
  contractor: '#2563eb',
};

export const INVENTORY_CATEGORY_COLORS: Record<string, string> = {
  fertilizer: '#047857',
  herbicide: '#dc2626',
  pesticide: '#d97706',
  fungicide: '#7c3aed',
  feed: '#a16207',
  seed: '#0d9488',
  fuel: '#4b5563',
  other: '#9ca3af',
};
