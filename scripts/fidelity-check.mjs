/**
 * Chequeo de contrato de fidelidad (sin DOM/Fabric en Node).
 * Las pruebas con Fabric viven en src/lib/canvas/__tests__/ (requieren vitest + happy-dom).
 *
 * Uso: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const textPropsSrc = readFileSync(
  join(root, 'src/lib/canvas/text-props.ts'),
  'utf8',
);
const renderSrc = readFileSync(
  join(root, 'src/lib/canvas/render-design.ts'),
  'utf8',
);
const serializerSrc = readFileSync(
  join(root, 'src/lib/canvas-serializer.ts'),
  'utf8',
);
const fontsSrc = readFileSync(join(root, 'src/lib/canvas/fonts.ts'), 'utf8');
const canvasEditorSrc = readFileSync(
  join(root, 'src/components/editor/Canvas.tsx'),
  'utf8',
);

assert.match(textPropsSrc, /lineHeight/);
assert.match(textPropsSrc, /charSpacing/);
assert.match(textPropsSrc, /CUSTOM_TEXT_PROPS/);

assert.match(fontsSrc, /ensureFontsLoaded/);
assert.match(fontsSrc, /document\.fonts\.ready/);

assert.match(renderSrc, /export async function renderDesign/);
assert.match(renderSrc, /export async function hydrateDesign/);
assert.match(renderSrc, /fitCanvasToContainer/);
assert.match(renderSrc, /recalculateTextboxHeights/);
assert.match(renderSrc, /setZoom/);

assert.match(serializerSrc, /lineHeight/);
assert.match(serializerSrc, /charSpacing/);
assert.match(
  serializerSrc,
  /Ancho fijo; el alto lo recalcula Fabric/,
);

assert.match(canvasEditorSrc, /hydrateDesign/);
assert.doesNotMatch(
  canvasEditorSrc,
  /await loadPageOntoCanvas\(canvas, page/,
);

console.log('fidelity-check: OK (contrato renderDesign / tipografía)');
