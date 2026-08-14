import {
  scanTemplateContentIssues,
  type TemplateContentScanInput,
  type TemplateContentScanResult,
  sanitizeUserStorageFolder,
} from '@shared/template-content-safety';

export { scanTemplateContentIssues, sanitizeUserStorageFolder };
export type { TemplateContentScanInput, TemplateContentScanResult };

export function describeTemplateContentIssues(result: TemplateContentScanResult): string[] {
  const messages: string[] = [];
  if (result.publicLinkCount > 0) {
    messages.push(
      `Se eliminarán ${result.publicLinkCount} enlace(s) a cartas públicas (QR/enlaces /p/…).`,
    );
  }
  if (result.menuExportThumbnail) {
    messages.push('La miniatura vinculada a una publicación no se incluirá en la plantilla.');
  }
  if (result.foreignAssetCount > 0) {
    messages.push(
      `${result.foreignAssetCount} imagen(es) privadas de otro usuario se sustituirán al usar la plantilla.`,
    );
  }
  return messages;
}

/** Avisos al guardar plantilla propia (sin mensajes de assets ajenos). */
export function describeTemplateSaveWarnings(result: TemplateContentScanResult): string[] {
  const messages: string[] = [];
  if (result.publicLinkCount > 0) {
    messages.push(
      `Se quitarán ${result.publicLinkCount} enlace(s) o QR embebidos que apuntan a cartas publicadas.`,
    );
  }
  if (result.menuExportThumbnail) {
    messages.push('No se incluirá la miniatura de una carta publicada.');
  }
  return messages;
}

export function scanTemplateContentForUser(
  content: TemplateContentScanInput,
  userEmail: string | null | undefined,
): TemplateContentScanResult {
  const folder = userEmail ? sanitizeUserStorageFolder(userEmail) : null;
  return scanTemplateContentIssues(content, folder);
}

export function hasTemplateContentIssues(result: TemplateContentScanResult): boolean {
  return (
    result.publicLinkCount > 0 ||
    result.foreignAssetCount > 0 ||
    result.menuExportThumbnail
  );
}
