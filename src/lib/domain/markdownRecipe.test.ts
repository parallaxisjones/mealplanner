import { describe, it, expect } from 'vitest';
import { parseMarkdownRecipe, analyzeMarkdownRecipe } from './markdownRecipe';

const webClip = `---
created: 2017-11-10T04:07:50+00:00
type: card
tags:
  - recipe
  - indian
  - chicken
---
up:: [[Cooking]]

# [Easy 20 Minute Butter Chicken](https://gimmedelicious.com/butter-chicken/)

Quick 20-minute butter chicken is creamy and packed full of flavor.

![img](https://example.com/a.jpg)

### Ingredients

- 1 tablespoon oil
- 1 medium onion (diced)
- 1 cup heavy cream

### Instructions

- Heat a skillet and cook the onions.
- Add the cream and simmer.
`;

const nonna = `---
created: 2025-07-12
tags:
  - nonna-donini
  - recipe
---

# Risotto

A simple comforting risotto.

**Servings:** 6

## Ingredients

- 1 medium onion
- 5 cups raw rice

## Instructions

1. Saute the onion.
2. Add the rice and stir.

## Notes

- Clarified the tomato gravy quantity.
`;

const multiComponent = `# Pastiera

## Pie Crust

### Ingredients

- 2 cups flour
- 1 stick butter

### Instructions

1. Make the crust.

## Filling

### Ingredients

- 1 cup ricotta
- 2 eggs

### Instructions

1. Mix the filling.
2. Bake.
`;

const projectDoc = `# M1.1 - Foundation + Recipe CRUD

## Goal

Build the recipe data model.

## Tasks

- Define types
- Wire the repo
`;

const moc = `# Nonna Donini's Cookbook

## Table of Contents

- [[Risotto]]
- [[Amaretti]]
`;

const noH1 = `## Ingredients

- 1 lb ground beef
- 1 cup breadcrumbs

## Instructions

1. Mix ingredients.
2. Bake at 375F for 20 minutes.
`;

describe('parseMarkdownRecipe', () => {
  it('parses a web clip: title, source_url from the title link, ingredients, steps', () => {
    const r = parseMarkdownRecipe(webClip)!;
    expect(r.title).toBe('Easy 20 Minute Butter Chicken');
    expect(r.source_url).toBe('https://gimmedelicious.com/butter-chicken/');
    expect(r.ingredients).toEqual(['1 tablespoon oil', '1 medium onion (diced)', '1 cup heavy cream']);
    expect(r.steps).toEqual(['Heat a skillet and cook the onions.', 'Add the cream and simmer.']);
  });

  it('drops the generic "recipe" tag and normalizes the rest', () => {
    const r = parseMarkdownRecipe(webClip)!;
    expect(r.tags).toEqual(['indian', 'chicken']);
  });

  it('folds the intro paragraph into notes and ignores images/metadata lines', () => {
    const r = parseMarkdownRecipe(webClip)!;
    expect(r.notes).toContain('Quick 20-minute butter chicken');
    expect(r.notes).not.toContain('![');
    expect(r.notes).not.toContain('up::');
  });

  it('parses servings and a Notes section (## headings, numbered steps)', () => {
    const r = parseMarkdownRecipe(nonna)!;
    expect(r.title).toBe('Risotto');
    expect(r.source_url).toBeNull();
    expect(r.servings).toBe(6);
    expect(r.steps).toEqual(['Saute the onion.', 'Add the rice and stir.']);
    expect(r.notes).toContain('Clarified the tomato gravy');
    expect(r.notes).toContain('A simple comforting risotto');
  });

  it('collects ALL ingredient/step sections for multi-component recipes', () => {
    const r = parseMarkdownRecipe(multiComponent)!;
    expect(r.ingredients).toEqual(['2 cups flour', '1 stick butter', '1 cup ricotta', '2 eggs']);
    expect(r.steps).toEqual(['Make the crust.', 'Mix the filling.', 'Bake.']);
  });

  it('exposes frontmatter created verbatim for later date mapping', () => {
    expect(parseMarkdownRecipe(nonna)!.created).toBe('2025-07-12');
  });

  it('returns null for a project doc (no ingredients/steps pair)', () => {
    expect(parseMarkdownRecipe(projectDoc)).toBeNull();
  });

  it('returns null for a MOC / table-of-contents file', () => {
    expect(parseMarkdownRecipe(moc)).toBeNull();
  });
});

describe('fallback title', () => {
  it('uses the fallback title when the note has no H1', () => {
    const r = parseMarkdownRecipe(noH1, 'Meatball Sliders')!;
    expect(r).not.toBeNull();
    expect(r.title).toBe('Meatball Sliders');
  });

  it('still returns null when there is no H1 and no fallback title', () => {
    expect(parseMarkdownRecipe(noH1)).toBeNull();
  });

  it('prefers an explicit H1 over the fallback title', () => {
    const r = parseMarkdownRecipe(nonna, 'Some Filename')!;
    expect(r.title).toBe('Risotto');
  });
});

describe('analyzeMarkdownRecipe', () => {
  it('reports a near-miss reason when steps are missing', () => {
    const md = '# Salad\n\n## Ingredients\n\n- lettuce\n- tomato\n';
    const res = analyzeMarkdownRecipe(md);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('no steps');
      expect(res.hadTitle).toBe(true);
      expect(res.ingredientCount).toBe(2);
    }
  });
});
