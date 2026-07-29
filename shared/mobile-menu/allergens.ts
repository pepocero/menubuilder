/** Alérgenos de declaración obligatoria (UE) — etiquetas del editor. */
export const COMMON_ALLERGENS = [
  'Gluten',
  'Crustáceos',
  'Huevos',
  'Pescado',
  'Cacahuetes',
  'Soja',
  'Lácteos',
  'Frutos de cáscara',
  'Apio',
  'Mostaza',
  'Sésamo',
  'Sulfitos',
  'Altramuces',
  'Moluscos',
] as const;

export type CommonAllergen = (typeof COMMON_ALLERGENS)[number];

export function parseAllergenTags(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;·•]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function isAllergenSelected(raw: string | undefined, allergen: string): boolean {
  const needle = allergen.trim().toLowerCase();
  return parseAllergenTags(raw).some((item) => item.toLowerCase() === needle);
}

/** Activa/desactiva un alérgeno conocido; conserva entradas personalizadas. */
export function toggleAllergenTag(raw: string | undefined, allergen: string): string {
  const current = parseAllergenTags(raw);
  const needle = allergen.trim().toLowerCase();
  const without = current.filter((item) => item.toLowerCase() !== needle);
  const wasSelected = without.length !== current.length;
  const next = wasSelected ? without : [...current, allergen.trim()];

  const known = COMMON_ALLERGENS.filter((name) =>
    next.some((item) => item.toLowerCase() === name.toLowerCase()),
  );
  const custom = next.filter(
    (item) => !COMMON_ALLERGENS.some((name) => name.toLowerCase() === item.toLowerCase()),
  );
  return [...known, ...custom].join('\n');
}
