import type { Task } from '../types/calendar';

// ---------- Transition triggers ----------

export interface TransitionSuggestion {
  fieldId: string;
  fieldName: string;
  fromUsage: string;
  toUsage: string;
  templateName: string | null;
  message: string;
}

/**
 * MVP check: fields with no tasks in the last 30 days get a
 * "Set up tasks for {enterprise}?" suggestion.
 */
export function checkTransitionTriggers(
  fields: Array<{ id: string; name: string; enterprise: string }>,
  tasks: Task[],
): TransitionSuggestion[] {
  const IDLE_DAYS = 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - IDLE_DAYS);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const suggestions: TransitionSuggestion[] = [];

  for (const field of fields) {
    const fieldTasks = tasks.filter((t) => t.field_id === field.id);

    // Check if any task has a due_date within the last 30 days
    const hasRecent = fieldTasks.some((t) => {
      const dateStr = t.due_date ?? t.completed_date;
      return dateStr != null && dateStr >= cutoffISO;
    });

    if (!hasRecent) {
      suggestions.push({
        fieldId: field.id,
        fieldName: field.name,
        fromUsage: '',
        toUsage: field.enterprise,
        templateName: null,
        message: `${field.name} has no recent tasks — set up tasks for ${field.enterprise}?`,
      });
    }
  }

  return suggestions;
}

// ---------- PHI enforcement ----------

export interface PhiWarning {
  fieldId: string;
  fieldName: string;
  chemical: string;
  appliedDate: string;
  phiDays: number;
  clearsDate: string;
  message: string;
}

/** Common SA chemicals and their PHI in days */
const PHI_DATABASE: Record<string, number> = {
  'delegate': 60,
  'chlorpyrifos': 21,
  'mancozeb': 14,
  'copper oxychloride': 7,
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Check if any recent spray inputs on the field have active PHI windows
 * that conflict with a proposed harvest date.
 */
export function checkPhiWarnings(
  fieldId: string,
  fieldName: string,
  taskInputs: Array<{ product_name: string; date?: string }>,
  harvestDate: string,
): PhiWarning[] {
  const warnings: PhiWarning[] = [];

  for (const input of taskInputs) {
    if (!input.date) continue;

    const productLower = input.product_name.toLowerCase().trim();
    const phiDays = PHI_DATABASE[productLower];
    if (phiDays == null) continue;

    const clearsDate = addDays(input.date, phiDays);

    if (harvestDate < clearsDate) {
      warnings.push({
        fieldId,
        fieldName,
        chemical: productLower,
        appliedDate: input.date,
        phiDays,
        clearsDate,
        message: `${input.product_name} applied ${input.date} — PHI ${phiDays} days, clears ${clearsDate}. Harvest on ${harvestDate} is too early.`,
      });
    }
  }

  return warnings;
}
