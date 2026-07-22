import { extractMenuWithVision } from '../../lib/vision-ocr';
import { errorResponse, jsonResponse } from '../../lib/types';
import { parseOcrProviderChoice } from '../../../shared/ocr-providers';
import { isSystemAdminEmail } from '../../../shared/roles';

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse('Formulario inválido', 400);
  }

  const entry = form.get('file');
  if (!entry || typeof entry === 'string') {
    return errorResponse('Falta el archivo de imagen (file)', 400);
  }

  const provider = parseOcrProviderChoice(form.get('provider'));
  const email = typeof context.data.email === 'string' ? context.data.email : '';
  const promptExtraRaw = form.get('prompt_extra');
  // Solo system_admin puede enviar indicaciones extra al prompt.
  const promptExtra =
    isSystemAdminEmail(email) && typeof promptExtraRaw === 'string' ? promptExtraRaw : '';

  const file = entry as Blob;
  const mime = ((file as File).type || 'image/jpeg').toLowerCase();
  if (!ALLOWED.has(mime) && !mime.startsWith('image/')) {
    return errorResponse('Formato de imagen no soportado', 400);
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return errorResponse('La imagen debe pesar entre 1 byte y 6 MB', 400);
  }

  try {
    const bytes = await file.arrayBuffer();
    const menu = await extractMenuWithVision(
      env,
      bytes,
      mime.startsWith('image/') ? mime : 'image/jpeg',
      provider,
      promptExtra,
    );

    if (!menu.headerTitle && menu.sections.length === 0) {
      return errorResponse('No se pudo leer texto de la carta en la imagen', 422);
    }

    return jsonResponse({ menu, provider: menu.provider ?? provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en OCR por visión';
    const status = /no configurad/i.test(message) ? 503 : 502;
    return errorResponse(message, status);
  }
};
