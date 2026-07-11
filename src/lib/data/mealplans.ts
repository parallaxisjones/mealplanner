import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
import { getRepo, getWorkspaceUrl } from './repo';
import { weekToDates } from '$lib/domain/week';
import type { DayPlan, MealPlanDoc, MealSlot, PlanEntry, WorkspaceDoc } from '$lib/domain/types';

function emptyDay(): DayPlan {
	return { breakfast: [], lunch: [], dinner: [], snack: [] };
}

/**
 * Find (or create) the meal-plan document for an ISO week, recording it and the
 * current week in the workspace. The workspace's `plans` map is the discovery
 * index since automerge-repo has no query layer.
 */
export async function getOrCreatePlan(week: string): Promise<AutomergeUrl> {
	const repo = await getRepo();
	const wsUrl = await getWorkspaceUrl();
	const ws = await repo.find<WorkspaceDoc>(wsUrl);

	const existing = ws.doc().plans[week];
	if (existing) {
		if (ws.doc().current_week !== week) {
			ws.change((w) => {
				w.current_week = week;
			});
			await repo.flush([ws.documentId]);
		}
		return existing as AutomergeUrl;
	}

	const days: Record<string, DayPlan> = {};
	for (const date of weekToDates(week)) days[date] = emptyDay();
	const handle = repo.create<MealPlanDoc>({ schema: 1, week, days });
	ws.change((w) => {
		w.plans[week] = handle.url;
		w.current_week = week;
	});
	await repo.flush([handle.documentId, ws.documentId]);
	return handle.url;
}

export async function addPlanEntry(
	week: string,
	date: string,
	slot: MealSlot,
	entry: PlanEntry
): Promise<void> {
	const repo = await getRepo();
	const url = await getOrCreatePlan(week);
	const handle = await repo.find<MealPlanDoc>(url);
	handle.change((p) => {
		if (!p.days[date]) p.days[date] = emptyDay();
		p.days[date][slot].push(entry);
	});
	await repo.flush([handle.documentId]);
}

export async function removePlanEntry(
	planUrl: string,
	date: string,
	slot: MealSlot,
	index: number
): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<MealPlanDoc>(planUrl as AutomergeUrl);
	handle.change((p) => {
		p.days[date]?.[slot].splice(index, 1);
	});
	await repo.flush([handle.documentId]);
}

export async function setPlanEntryServings(
	planUrl: string,
	date: string,
	slot: MealSlot,
	index: number,
	servings: number | null
): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<MealPlanDoc>(planUrl as AutomergeUrl);
	handle.change((p) => {
		const entry = p.days[date]?.[slot]?.[index];
		if (entry) entry.servings = servings;
	});
	await repo.flush([handle.documentId]);
}
