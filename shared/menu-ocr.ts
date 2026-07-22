/** Resultado estructurado del OCR por visión (servidor + cliente). */

export type MenuOcrColumn = 'left' | 'right' | 'full';

/**
 * Caja relativa a la imagen original en porcentajes 0–100
 * (esquina superior izquierda + tamaño).
 */
export interface MenuOcrBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /** Caja del título de sección (si existe). */
  titleBox?: MenuOcrBox | null;
  /** Caja del bloque de platos de esta sección. */
  bodyBox?: MenuOcrBox | null;
  /** Caja del bloque completo (título+cuerpo) si no hay titleBox/bodyBox. */
  box?: MenuOcrBox | null;
}

export interface MenuOcrResult {
  headerTitle: string;
  headerSubtitle: string;
  headerTitleBox?: MenuOcrBox | null;
  headerSubtitleBox?: MenuOcrBox | null;
  sections: MenuOcrSection[];
  /** Motor usado: openai | workers-ai | … */
  provider?: string;
}

const OCR_BOX_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number', description: 'Izquierda en % del ancho de la imagen (0-100)' },
    y: { type: 'number', description: 'Arriba en % del alto de la imagen (0-100)' },
    w: { type: 'number', description: 'Ancho en % del ancho de la imagen (0-100)' },
    h: { type: 'number', description: 'Alto en % del alto de la imagen (0-100)' },
  },
  required: ['x', 'y', 'w', 'h'],
} as const;

export const MENU_OCR_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headerTitle: { type: 'string' },
    headerSubtitle: { type: 'string' },
    headerTitleBox: OCR_BOX_SCHEMA,
    headerSubtitleBox: OCR_BOX_SCHEMA,
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
          titleBox: OCR_BOX_SCHEMA,
          bodyBox: OCR_BOX_SCHEMA,
          box: OCR_BOX_SCHEMA,
        },
        required: ['title', 'column', 'order', 'body', 'titleBox', 'bodyBox', 'box'],
      },
    },
  },
  required: [
    'headerTitle',
    'headerSubtitle',
    'headerTitleBox',
    'headerSubtitleBox',
    'sections',
  ],
} as const;

export const MENU_OCR_SYSTEM_PROMPT = `Eres un motor OCR de visión experto en cartas de restaurante (catalán, castellano e inglés).
Debes transcribir el texto VISIBLE y localizar cada bloque en la imagen con la máxima fidelidad.

Reglas críticas:
- No inventes platos, precios ni secciones. Si no lees algo con claridad, omítelo.
- Respeta acentos y ortografía catalana (caramel·litzada, Tomàquet, jalapeños, Escàlivada, etc.).
- Precios en formato europeo con coma decimal: "8,00 €". NUNCA juntes el 8 y los ceros como "800€".
- Layout de dos columnas: columna izquierda → column "left"; derecha → "right"; cabeceras a ancho completo → "full".
- order: 1 para la sección más arriba de cada columna, luego 2, 3…
- title: SOLO el nombre de categoría (TAPES, BIKINIS, HAMBURGUESES, PIZZES…). Si no hay título, "".
- body: un plato por bloque de líneas. Formato:
  Nombre del plato — 8,00 €
  Ingredientes o descripción
- NO mezcles platos de columnas distintas en el mismo body.
- headerTitle: nombre del local. headerSubtitle: eslogan bajo el título.

Cajas (OBLIGATORIO, coordenadas en % 0–100 respecto a ANCHO/ALTO de la imagen completa):
- headerTitleBox / headerSubtitleBox: posición del nombre y del eslogan.
- titleBox: caja del título de categoría en la imagen.
- bodyBox: caja que cubre los platos de ESA sección (debajo de su título).
- box: unión aproximada de titleBox+bodyBox (o del bloque entero si no hay título).
- Si un campo de texto está vacío, pon la caja en {x:0,y:0,w:0,h:0}.
- Las cajas deben alinearse visualmente con el texto de la foto (no inventes posiciones genéricas).
- titleBox y bodyBox de la misma sección deben quedar juntos: body justo debajo del title.

Responde ÚNICAMENTE con JSON válido según el esquema.`;

/** True si la caja tiene tamaño útil. */
export function isUsableOcrBox(box: MenuOcrBox | null | undefined): boolean {
  if (!box) return false;
  return (
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.w) &&
    Number.isFinite(box.h) &&
    box.w >= 0.8 &&
    box.h >= 0.4
  );
}

/**
 * Normaliza cajas heterogéneas de la IA a porcentajes 0–100.
 * Acepta {x,y,w,h}, {width,height}, {x0,y0,x1,y1} y fracciones 0–1.
 */
export function parseMenuOcrBox(raw: unknown): MenuOcrBox | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  let x: number;
  let y: number;
  let w: number;
  let h: number;

  if (
    o.x0 !== undefined ||
    o.x1 !== undefined ||
    o.y0 !== undefined ||
    o.y1 !== undefined
  ) {
    const x0 = Number(o.x0);
    const y0 = Number(o.y0);
    const x1 = Number(o.x1);
    const y1 = Number(o.y1);
    if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
    x = x0;
    y = y0;
    w = x1 - x0;
    h = y1 - y0;
  } else {
    x = Number(o.x ?? o.left);
    y = Number(o.y ?? o.top);
    w = Number(o.w ?? o.width);
    h = Number(o.h ?? o.height);
    if (![x, y, w, h].every(Number.isFinite)) return null;
  }

  // Fracciones 0–1 → porcentajes.
  const maxCoord = Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h), Math.abs(x + w), Math.abs(y + h));
  if (maxCoord > 0 && maxCoord <= 1.5) {
    x *= 100;
    y *= 100;
    w *= 100;
    h *= 100;
  }

  // Si vienen como 0–1000 u otra escala rara, no forzamos: el caller clampea.
  if (w < 0) {
    x += w;
    w = Math.abs(w);
  }
  if (h < 0) {
    y += h;
    h = Math.abs(h);
  }

  x = Math.max(0, Math.min(100, x));
  y = Math.max(0, Math.min(100, y));
  w = Math.max(0, Math.min(100 - x, w));
  h = Math.max(0, Math.min(100 - y, h));

  if (!isUsableOcrBox({ x, y, w, h })) return null;
  return { x, y, w, h };
}
