/// <reference types="@cloudflare/workers-types" />
import type { NutritionData } from '../src/lib/domain/types';

export interface NutritionEnv {
	USDA_API_KEY?: string;
}

function num(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
	return null;
}

async function fromOpenFoodFacts(name: string): Promise<NutritionData | null> {
	const url =
		'https://world.openfoodfacts.org/cgi/search.pl?json=1&page_size=5&fields=product_name,nutriments,unique_scans_n&search_terms=' +
		encodeURIComponent(name);
	const res = await fetch(url, { headers: { 'user-agent': 'MealPlanner/1.0 (personal use)' } });
	if (!res.ok) return null;
	const data = (await res.json()) as { products?: Array<{ nutriments?: Record<string, unknown>; unique_scans_n?: number }> };
	const products = (data.products ?? []).slice();
	if (!products.length) return null;
	products.sort((a, b) => (b.unique_scans_n ?? 0) - (a.unique_scans_n ?? 0));
	const n = products[0].nutriments ?? {};
	const sodiumG = num(n['sodium_100g']);
	return {
		calories: num(n['energy-kcal_100g']),
		protein_g: num(n['proteins_100g']),
		fat_g: num(n['fat_100g']),
		carbs_g: num(n['carbohydrates_100g']),
		fiber_g: num(n['fiber_100g']),
		sodium_mg: sodiumG == null ? null : sodiumG * 1000, // OFF reports sodium in g/100g
		source: 'off',
		basis: 'per100g',
		fetched_at: new Date().toISOString()
	};
}

async function fromUsda(name: string, key: string): Promise<NutritionData | null> {
	const url =
		'https://api.nal.usda.gov/fdc/v1/foods/search?pageSize=5&dataType=Foundation,SR%20Legacy&api_key=' +
		encodeURIComponent(key) +
		'&query=' +
		encodeURIComponent(name);
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = (await res.json()) as { foods?: Array<{ foodNutrients?: Array<{ nutrientId: number; value: number }> }> };
	const food = (data.foods ?? [])[0];
	if (!food) return null;
	const byId = new Map((food.foodNutrients ?? []).map((fn) => [fn.nutrientId, fn.value]));
	const g = (id: number) => (typeof byId.get(id) === 'number' ? (byId.get(id) as number) : null);
	return {
		calories: g(1008),
		protein_g: g(1003),
		fat_g: g(1004),
		carbs_g: g(1005),
		fiber_g: g(1079),
		sodium_mg: g(1093),
		source: 'usda',
		basis: 'per100g',
		fetched_at: new Date().toISOString()
	};
}

export async function handleNutrition(request: Request, env: NutritionEnv): Promise<Response> {
	const name = new URL(request.url).searchParams.get('name');
	if (!name || !name.trim()) return Response.json({ error: 'Missing name' }, { status: 400 });
	try {
		let data = await fromOpenFoodFacts(name.trim());
		if (!data && env.USDA_API_KEY) data = await fromUsda(name.trim(), env.USDA_API_KEY);
		if (!data) return Response.json({ error: 'No nutrition match' }, { status: 404 });
		return Response.json(data);
	} catch {
		return Response.json({ error: 'Nutrition lookup failed' }, { status: 502 });
	}
}
