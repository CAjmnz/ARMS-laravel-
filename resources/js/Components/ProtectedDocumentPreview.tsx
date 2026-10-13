import { useEffect, useState } from 'react';

type PreviewPayload =
    | { kind: 'text'; text: string; truncated?: boolean; format?: string }
    | { kind: 'table'; rows: string[][]; truncated?: boolean; format?: string }
    | { kind: 'unsupported'; message: string; format?: string };

interface ProtectedDocumentPreviewProps {
    viewerUrl: string;
    filename: string;
}

function previewUrl(viewerUrl: string): string {
    return viewerUrl.replace(/\/viewer(?=[?#]|$)/, '/preview-content');
}

export default function ProtectedDocumentPreview({ viewerUrl, filename }: ProtectedDocumentPreviewProps) {
    const [payload, setPayload] = useState<PreviewPayload | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        setPayload(null);
        setError('');

        fetch(previewUrl(viewerUrl), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(response.status === 403
                        ? 'You do not have permission to view this document.'
                        : response.status === 409
                            ? 'The protected preview is still being prepared. Please try again shortly.'
                            : 'The protected preview could not be loaded.');
                }
                return response.json() as Promise<PreviewPayload>;
            })
            .then(setPayload)
            .catch((reason: unknown) => {
                if (controller.signal.aborted) return;
                setError(reason instanceof Error ? reason.message : 'The protected preview could not be loaded.');
            });

        return () => controller.abort();
    }, [viewerUrl]);

    return (
        <div className="h-full min-h-[420px] w-full overflow-auto rounded-lg bg-white text-stone-800">
            {!payload && !error && (
                <div className="grid min-h-[420px] place-items-center text-sm text-stone-500">
                    <div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-emerald-700" /><p>Preparing protected preview…</p></div>
                </div>
            )}
            {error && <div role="alert" className="grid min-h-[420px] place-items-center p-8 text-center"><div><p className="font-semibold text-stone-800">Preview unavailable</p><p className="mt-2 max-w-lg text-sm leading-6 text-stone-500">{error}</p></div></div>}
            {payload?.kind === 'text' && (
                <div className="p-5 sm:p-8">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
                        <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{payload.format ?? 'Text preview'}</p><h3 className="mt-1 break-words text-sm font-semibold">{filename}</h3></div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Read-only</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6">{payload.text}</pre>
                    {payload.truncated && <p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">The preview is shortened to keep large documents responsive.</p>}
                </div>
            )}
            {payload?.kind === 'table' && (
                <div className="p-4 sm:p-6">
                    <div className="mb-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{payload.format ?? 'Table preview'}</p><h3 className="mt-1 break-words text-sm font-semibold">{filename}</h3><p className="mt-1 text-xs text-stone-500">Read-only · First 500 rows and 30 columns maximum</p></div>
                    <div className="max-h-[calc(100%-5rem)] overflow-auto rounded-lg border border-stone-200">
                        <table className="min-w-full border-collapse text-left text-xs">
                            <tbody>{payload.rows.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex === 0 ? 'bg-emerald-50 font-semibold' : 'odd:bg-white even:bg-stone-50'}>{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[320px] whitespace-pre-wrap break-words border-b border-r border-stone-200 px-3 py-2 align-top">{cell}</td>)}</tr>)}</tbody>
                        </table>
                    </div>
                    {payload.truncated && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">The preview is shortened to keep large files responsive.</p>}
                </div>
            )}
            {payload?.kind === 'unsupported' && (
                <div className="grid min-h-[420px] place-items-center p-8 text-center">
                    <div className="max-w-xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><span className="text-2xl">▤</span></div>
                        <p className="mt-4 text-base font-semibold text-stone-800">Protected preview for this format is unavailable</p>
                        <p className="mt-2 break-words text-sm leading-6 text-stone-500">{payload.message}</p>
                        <p className="mt-4 text-xs text-stone-400">File: {filename}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
