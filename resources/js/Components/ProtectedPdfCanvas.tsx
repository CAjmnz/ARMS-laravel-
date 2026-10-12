import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ViewMode = 'single' | 'vertical';

interface ProtectedPdfCanvasProps {
    src: string;
    page: number;
    onPageChange: (page: number) => void;
    zoom: number;
    fit: boolean;
    mode: ViewMode;
    onPageCount: (count: number) => void;
    onVisiblePageChange?: (page: number) => void;
    className?: string;
    lazy?: boolean;
}

export default function ProtectedPdfCanvas({
    src,
    page,
    onPageChange,
    zoom,
    fit,
    mode,
    onPageCount,
    onVisiblePageChange,
    className = '',
    lazy = false,
}: ProtectedPdfCanvasProps) {
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [loading, setLoading] = useState(!lazy);
    const [shouldLoad, setShouldLoad] = useState(!lazy);
    const [error, setError] = useState('');
    const [containerWidth, setContainerWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
    const renderTasks = useRef<Array<{ cancel: () => void }>>([]);
    const callbacksRef = useRef({ onPageCount, onPageChange, onVisiblePageChange });
    callbacksRef.current = { onPageCount, onPageChange, onVisiblePageChange };

    useEffect(() => {
        if (!lazy) {
            setShouldLoad(true);
            return;
        }
        const element = containerRef.current;
        if (!element) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setShouldLoad(true);
                setLoading(true);
                observer.disconnect();
            }
        }, { rootMargin: '900px 0px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, [lazy]);

    useEffect(() => {
        if (!shouldLoad) return;
        let cancelled = false;
        let loadedPdf: PDFDocumentProxy | null = null;
        setLoading(true);
        setError('');
        setPdf(null);
        callbacksRef.current.onPageCount(0);

        const loadingTask = pdfjsLib.getDocument({
            url: src,
            withCredentials: true,
            isEvalSupported: false,
        });

        loadingTask.promise
            .then((document) => {
                loadedPdf = document;
                if (cancelled) {
                    void document.destroy();
                    return;
                }
                setPdf(document);
                callbacksRef.current.onPageCount(document.numPages);
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) {
                    setError('This protected PDF could not be loaded. Check your access or try opening it again.');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
            renderTasks.current.forEach((task) => task.cancel());
            renderTasks.current = [];
            if (loadedPdf) void loadedPdf.destroy();
            else void loadingTask.destroy();
        };
    }, [src, shouldLoad]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const updateWidth = () => setContainerWidth(element.clientWidth);
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!pdf || !containerWidth) return;
        let cancelled = false;
        renderTasks.current.forEach((task) => task.cancel());
        renderTasks.current = [];

        const pages = mode === 'single'
            ? [Math.min(Math.max(page, 1), pdf.numPages)]
            : Array.from({ length: pdf.numPages }, (_, index) => index + 1);

        const renderPages = async () => {
            for (const pageNumber of pages) {
                if (cancelled) return;
                const canvas = canvasRefs.current.get(pageNumber);
                if (!canvas) continue;
                try {
                    const pdfPage = await pdf.getPage(pageNumber);
                    const baseViewport = pdfPage.getViewport({ scale: 1 });
                    const fitScale = Math.min((containerWidth - 32) / baseViewport.width, 1.5);
                    const scale = fit ? Math.max(0.25, fitScale) : zoom;
                    const viewport = pdfPage.getViewport({ scale });
                    const context = canvas.getContext('2d', { alpha: false });
                    if (!context) continue;

                    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
                    canvas.width = Math.floor(viewport.width * pixelRatio);
                    canvas.height = Math.floor(viewport.height * pixelRatio);
                    canvas.style.width = `${Math.floor(viewport.width)}px`;
                    canvas.style.height = `${Math.floor(viewport.height)}px`;
                    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, viewport.width, viewport.height);

                    const task = pdfPage.render({ canvasContext: context, viewport });
                    renderTasks.current.push(task);
                    await task.promise;
                } catch (renderError) {
                    if (!(renderError instanceof Error) || renderError.name !== 'RenderingCancelledException') {
                        if (!cancelled) setError('A page could not be rendered. Try changing the zoom or reopening the document.');
                    }
                }
            }
        };

        void renderPages();
        return () => {
            cancelled = true;
            renderTasks.current.forEach((task) => task.cancel());
            renderTasks.current = [];
        };
    }, [pdf, mode === 'single' ? page : 0, zoom, fit, mode, containerWidth]);

    const updateVisiblePage = () => {
        const container = containerRef.current;
        if (!container || mode !== 'vertical') return;
        const canvases = Array.from(container.querySelectorAll<HTMLCanvasElement>('[data-pdf-page]'));
        if (!canvases.length) return;
        const containerTop = container.getBoundingClientRect().top;
        let visiblePage = 1;
        let closest = Number.POSITIVE_INFINITY;
        canvases.forEach((canvas) => {
            const distance = Math.abs(canvas.getBoundingClientRect().top - containerTop - 24);
            if (distance < closest) {
                closest = distance;
                visiblePage = Number(canvas.dataset.pdfPage) || 1;
            }
        });
        callbacksRef.current.onVisiblePageChange?.(visiblePage);
    };

    return (
        <div
            ref={containerRef}
            onScroll={updateVisiblePage}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            className={`relative min-h-full w-full overflow-visible ${className}`}
        >
            {loading && (
                <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-[#24313a] text-sm font-medium text-white">
                    <span className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Loading protected PDF…
                    </span>
                </div>
            )}
            {error && (
                <div role="alert" className="mx-auto mt-8 max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                    <p className="font-semibold">Preview unavailable</p>
                    <p className="mt-1">{error}</p>
                </div>
            )}
            {pdf && !error && (
                <div className={mode === 'vertical' ? 'flex min-h-full flex-col items-center gap-6 py-2' : 'flex min-h-full items-start justify-center py-2'}>
                    {(mode === 'single' ? [Math.min(Math.max(page, 1), pdf.numPages)] : Array.from({ length: pdf.numPages }, (_, index) => index + 1)).map((pageNumber) => (
                        <section key={pageNumber} data-pdf-page={pageNumber} className="flex w-full shrink-0 justify-center">
                            <canvas
                                ref={(canvas) => {
                                    if (canvas) canvasRefs.current.set(pageNumber, canvas);
                                    else canvasRefs.current.delete(pageNumber);
                                }}
                                aria-label={`PDF page ${pageNumber} of ${pdf.numPages}`}
                                className="max-w-none bg-white shadow-xl"
                            />
                        </section>
                    ))}
                </div>
            )}
            {pdf && mode === 'single' && (
                <div className="sticky bottom-3 flex justify-center">
                    <div className="flex items-center gap-2 rounded-full bg-slate-950/85 px-3 py-2 text-xs text-white shadow-lg">
                        <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="rounded px-2 py-1 hover:bg-white/15 disabled:opacity-35">Previous</button>
                        <span>Page {Math.min(Math.max(page, 1), pdf.numPages)} of {pdf.numPages}</span>
                        <button type="button" disabled={page >= pdf.numPages} onClick={() => onPageChange(Math.min(pdf.numPages, page + 1))} className="rounded px-2 py-1 hover:bg-white/15 disabled:opacity-35">Next</button>
                    </div>
                </div>
            )}
        </div>
    );
}
