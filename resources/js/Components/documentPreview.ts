export type DocumentPreviewKind = 'pdf' | 'image' | 'browser';

const IMAGE_EXTENSIONS = new Set([
    'PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP', 'AVIF', 'SVG', 'ICO',
]);

/**
 * Resolve the display format from the stored extension, MIME type, or filename.
 * Older imported records do not always use the same representation for `type`.
 */
export function normalizedDocumentType(type?: string | null, filename?: string | null): string {
    const rawType = (type ?? '').trim().toLowerCase().split(';')[0].trim();
    const mimeTypes: Record<string, string> = {
        'application/pdf': 'PDF',
        'image/png': 'PNG',
        'image/jpeg': 'JPEG',
        'image/gif': 'GIF',
        'image/webp': 'WEBP',
        'image/bmp': 'BMP',
        'image/avif': 'AVIF',
        'image/svg+xml': 'SVG',
        'image/tiff': 'TIFF',
        'text/csv': 'CSV',
        'text/plain': 'TXT',
        'application/msword': 'DOC',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
        'application/vnd.ms-excel': 'XLS',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
        'application/vnd.ms-powerpoint': 'PPT',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    };
    const mappedMime = mimeTypes[rawType];
    if (mappedMime) return mappedMime;

    const normalizedType = rawType.replace(/^\./, '').toUpperCase();
    if (normalizedType && !rawType.includes('/') && !['FILE', 'DOCUMENT', 'OCTET-STREAM', 'UNKNOWN'].includes(normalizedType)) {
        return normalizedType === 'JPE' ? 'JPEG' : normalizedType;
    }

    const filenameExtension = (filename ?? '').split(/[?#]/)[0].split('.').pop() ?? '';
    const normalizedExtension = filenameExtension.replace(/^\./, '').trim().toUpperCase();
    return normalizedExtension === 'JPE' ? 'JPEG' : normalizedExtension;
}

export function documentPreviewKind(type?: string | null, filename?: string | null): DocumentPreviewKind {
    const normalizedType = normalizedDocumentType(type, filename);
    if (normalizedType === 'PDF') return 'pdf';
    if (IMAGE_EXTENSIONS.has(normalizedType)) return 'image';
    return 'browser';
}

export function isDocumentImage(type?: string | null, filename?: string | null): boolean {
    return documentPreviewKind(type, filename) === 'image';
}

export function isDocumentPdf(type?: string | null, filename?: string | null): boolean {
    return documentPreviewKind(type, filename) === 'pdf';
}
