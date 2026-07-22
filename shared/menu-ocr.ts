/** Resultado estructurado del OCR por visión (servidor + cliente). */

export type MenuOcrColumn = 'left' | 'right' | 'full';

export interface MenuOcrSection {
  /** Categoría (TAPES, BIKINIS…). Vacío si es bloque sin título. */
  title: string;
  column: MenuOcrColumn;
  /** Orden vertical dentro de la columna (1 = arriba). */
  order: number;
  /**
   * Contenido de la sección: un plato por línea.
   * Preferible: "Nombre — 8,00 €" y descripción en la línea siguiente.
   */
  body: string;
}

export interface MenuOcrResult {
  headerTitle: string;
  headerSubtitle: string;
  sections: MenuOcrSection[];
  /** Motor usado: openai | workers-ai | … */
  provider?: string;
}

export const MENU_OCR_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headerTitle: { type: 'string' },
    headerSubtitle: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          column: { type: 'string', enum: ['left', 'right', 'full'] },
          order: { type: 'number' },
          body: { type: 'string' },
        },
        required: ['title', 'column', 'order', 'body'],
      },
    },
  },
  required: ['headerTitle', 'headerSubtitle', 'sections'],
} as const;

export const MENU_OCR_SYSTEM_PROMPT = `Eres un motor OCR de visión experto en cartas de restaurante (catalán, castellano e inglés).
Debes transcribir el texto VISIBLE con la máxima fidelidad, como haría un humano al leer la carta.

Reglas críticas:
- No inventes platos, precios ni secciones. Si no lees algo con claridad, omítelo o marca lo dudoso sin inventar.
- Respeta acentos y ortografía catalana (caramel·litzada, Tomàquet, jalapeños, Escàlivada, etc.).
- Precios en formato europeo con coma decimal: "8,00 €". NUNCA juntes el 8 y los ceros como "800€".
- Layout de dos columnas: cada sección de la columna izquierda → column "left"; derecha → "right". Cabeceras a ancho completo → "full".
- order: 1 para la sección más arriba de cada columna, luego 2, 3…
- title: SOLO el nombre de categoría en mayúsculas o destacado (TAPES, BIKINIS, HAMBURGUESES, PIZZES, ENTREPANS, FRANKFURTS, AMANIDES…). Si no hay título, "".
- body: un plato por bloque de líneas. Formato:
  Nombre del plato — 8,00 €
  Ingredientes o descripción
- NO mezcles platos de columnas distintas en el mismo body.
- headerTitle: nombre del local. headerSubtitle: eslogan o línea bajo el título (p. ej. "Pizzes i hamburgueses…").

Responde ÚNICAMENTE con JSON válido según el esquema.`;
