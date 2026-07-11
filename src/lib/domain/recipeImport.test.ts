import { describe, it, expect } from 'vitest';
import { parseRecipeJsonLd } from './recipeImport';

describe('parseRecipeJsonLd', () => {
	it('extracts a standard Recipe (HowToStep instructions, ImageObject)', () => {
		const node = {
			'@context': 'https://schema.org',
			'@type': 'Recipe',
			name: 'Lemon Chicken',
			recipeIngredient: ['2 lb chicken', '1 lemon'],
			recipeInstructions: [
				{ '@type': 'HowToStep', text: 'Season the chicken.' },
				{ '@type': 'HowToStep', text: 'Roast 40 minutes.' }
			],
			image: { '@type': 'ImageObject', url: 'https://x/img.jpg' },
			recipeYield: '4 servings',
			totalTime: 'PT45M'
		};
		const r = parseRecipeJsonLd([node]);
		expect(r).not.toBeNull();
		expect(r!.title).toBe('Lemon Chicken');
		expect(r!.ingredients).toEqual(['2 lb chicken', '1 lemon']);
		expect(r!.steps).toEqual(['Season the chicken.', 'Roast 40 minutes.']);
		expect(r!.image).toBe('https://x/img.jpg');
		expect(r!.servings).toBe('4 servings');
		expect(r!.total_time).toBe('PT45M');
	});

	it('finds the Recipe inside an @graph and handles string instructions + string image', () => {
		const node = {
			'@graph': [
				{ '@type': 'WebSite', name: 'Site' },
				{
					'@type': ['Recipe', 'NewsArticle'],
					name: 'Pancakes',
					recipeIngredient: ['flour', 'milk'],
					recipeInstructions: 'Mix.\nCook.',
					image: ['https://x/a.jpg', 'https://x/b.jpg'],
					recipeYield: 8
				}
			]
		};
		const r = parseRecipeJsonLd([node]);
		expect(r!.title).toBe('Pancakes');
		expect(r!.steps).toEqual(['Mix.', 'Cook.']);
		expect(r!.image).toBe('https://x/a.jpg'); // first of array
		expect(r!.servings).toBe('8');
	});

	it('flattens HowToSection → itemListElement → HowToStep', () => {
		const node = {
			'@type': 'Recipe',
			name: 'Layered',
			recipeIngredient: [],
			recipeInstructions: [
				{
					'@type': 'HowToSection',
					name: 'Sauce',
					itemListElement: [
						{ '@type': 'HowToStep', text: 'Simmer sauce.' },
						{ '@type': 'HowToStep', text: 'Blend.' }
					]
				},
				{ '@type': 'HowToStep', text: 'Assemble.' }
			]
		};
		const r = parseRecipeJsonLd([node]);
		expect(r!.steps).toEqual(['Simmer sauce.', 'Blend.', 'Assemble.']);
	});

	it('returns null when no Recipe node is present', () => {
		expect(parseRecipeJsonLd([{ '@type': 'WebSite', name: 'x' }])).toBeNull();
	});
});
