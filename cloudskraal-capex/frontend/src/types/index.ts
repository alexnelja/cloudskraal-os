export type ProjectType =
  | 'equipment'
  | 'infrastructure'
  | 'land'
  | 'livestock'
  | 'irrigation'
  | 'solar'
  | 'storage'
  | 'vehicle'
  | 'other';

export type ProjectStatus = 'draft' | 'evaluating' | 'approved' | 'rejected' | 'completed';

export type PriorityTier = 'tier1' | 'tier2' | 'tier3';

export type RepaymentType = 'equal_installments' | 'equal_principal' | 'bullet';

export interface CashFlow {
  id: string;
  projectId: string;
  year: number;
  revenue: number;
  operatingCosts: number;
  netCashFlow: number;
}

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  debtPercent: number;
  equityPercent: number;
  interestRate: number;
  loanTermYears: number;
  equityCostPercent: number;
  repaymentType: RepaymentType;
  // Computed fields from API
  wacc?: number;
  npv?: number;
  irr?: number;
  paybackYears?: number;
  profitabilityIndex?: number;
  monthlyPayment?: number;
  totalInterest?: number;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  description: string;
  initialOutlay: number;
  usefulLifeYears: number;
  salvageValue: number;
  status: ProjectStatus;
  priority: PriorityTier;
  taxBenefit: string | null;
  createdAt: string;
  updatedAt: string;
  cashFlows: CashFlow[];
  scenarios: Scenario[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  type: ProjectType;
  initialOutlay: number;
  status: ProjectStatus;
  priority: PriorityTier;
  taxBenefit: string | null;
  bestNpv: number | null;
  bestIrr: number | null;
}

export interface DashboardStats {
  totalProjects: number;
  totalCapexBudget: number;
  avgIrr: number | null;
  bestNpvProject: { name: string; npv: number } | null;
}

export interface CreateProjectPayload {
  name: string;
  type: ProjectType;
  description: string;
  initialOutlay: number;
  usefulLifeYears: number;
  salvageValue: number;
}

export interface UpdateProjectPayload extends Partial<CreateProjectPayload> {
  status?: ProjectStatus;
}

export interface CashFlowPayload {
  year: number;
  revenue: number;
  operatingCosts: number;
}

export interface ScenarioPayload {
  name: string;
  debtPercent: number;
  equityPercent: number;
  interestRate: number;
  loanTermYears: number;
  equityCostPercent: number;
  repaymentType: RepaymentType;
}
