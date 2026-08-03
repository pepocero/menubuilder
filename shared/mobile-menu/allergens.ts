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

function isCommonAllergenName(name: string): boolean {
  const needle = name.trim().toLowerCase();
  return COMMON_ALLERGENS.some((item) => item.toLowerCase() === needle);
}

/** Etiquetas personalizadas (no están en COMMON_ALLERGENS). */
export function listCustomAllergenTags(raw: string | undefined): string[] {
  return parseAllergenTags(raw).filter((item) => !isCommonAllergenName(item));
}

function serializeAllergenTags(tags: string[]): string {
  const known = COMMON_ALLERGENS.filter((name) =>
    tags.some((item) => item.toLowerCase() === name.toLowerCase()),
  );
  const custom = tags.filter((item) => !isCommonAllergenName(item));
  return [...known, ...custom].join('\n');
}

export function isAllergenSelected(raw: string | undefined, allergen: string): boolean {
  const needle = allergen.trim().toLowerCase();
  return parseAllergenTags(raw).some((item) => item.toLowerCase() === needle);
}

/** Activa/desactiva un alérgeno; conserva entradas personalizadas. */
export function toggleAllergenTag(raw: string | undefined, allergen: string): string {
  const current = parseAllergenTags(raw);
  const needle = allergen.trim().toLowerCase();
  const without = current.filter((item) => item.toLowerCase() !== needle);
  const wasSelected = without.length !== current.length;
  const next = wasSelected ? without : [...current, allergen.trim()];
  return serializeAllergenTags(next);
}

/** Añade una etiqueta (común o personalizada). No duplica (case-insensitive). */
export function addAllergenTag(raw: string | undefined, allergen: string): string {
  const label = allergen.trim().replace(/\s+/g, ' ');
  if (!label) return raw?.trim() ? serializeAllergenTags(parseAllergenTags(raw)) : '';
  if (label.length > 64) return serializeAllergenTags(parseAllergenTags(raw));
  if (isAllergenSelected(raw, label)) {
    return serializeAllergenTags(parseAllergenTags(raw));
  }
  // Si coincide con uno común, guardar el nombre canónico.
  const canonical =
    COMMON_ALLERGENS.find((name) => name.toLowerCase() === label.toLowerCase()) ?? label;
  return serializeAllergenTags([...parseAllergenTags(raw), canonical]);
}

/** Quita una etiqueta por nombre (case-insensitive). */
export function removeAllergenTag(raw: string | undefined, allergen: string): string {
  const needle = allergen.trim().toLowerCase();
  if (!needle) return serializeAllergenTags(parseAllergenTags(raw));
  return serializeAllergenTags(
    parseAllergenTags(raw).filter((item) => item.toLowerCase() !== needle),
  );
}
