"use client";

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { RefreshCw as RefreshCw01, File as File02, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
    url: string;
    title?: string;
}

export const PdfViewer = ({ url, title }: PdfViewerProps) => {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [containerWidth, setContainerWidth] = useState<number | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    const filename = title || decodeURIComponent(url.split('/').pop()?.split('-').slice(1).join('-') || "Document.pdf");

    useEffect(() => {
        setIsMounted(true);
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    const setContainerRef = (el: HTMLDivElement | null) => {
        if (el) {
            setContainerWidth(el.offsetWidth);
        }
    };

    if (!isMounted) return null;

    return (
        <div className="flex flex-col gap-0 w-full bg-secondary/5 rounded-xl border border-secondary" ref={setContainerRef}>
            <div className="flex items-center justify-between p-3 border-b border-secondary bg-primary rounded-t-xl">
                <div className="flex flex-col gap-0.5">
                    <div className="text-sm font-semibold text-primary truncate max-w-[300px] sm:max-w-md">
                        {filename}
                    </div>
                    <div className="text-[10px] font-bold text-tertiary uppercase tracking-widest">
                        {numPages || '--'} Pages
                    </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => window.open(url, '_blank')}>
                    <ArrowUpRight className="size-4" />
                    Open
                </Button>
            </div>

            <div className="flex flex-col items-center gap-4 p-4 bg-secondary/10 overflow-auto max-h-[500px] min-h-[250px]">
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                        <div className="flex flex-col items-center justify-center p-20 gap-3">
                            <RefreshCw01 className="size-6 text-brand-solid animate-spin" />
                            <p className="text-sm font-medium text-tertiary">Loading PDF...</p>
                        </div>
                    }
                    error={
                        <div className="p-12 text-center flex flex-col items-center gap-3">
                            <div className="p-3 bg-error-primary/10 rounded-full text-error-primary">
                                <File02 className="size-6" />
                            </div>
                            <div>
                                <p className="text-sm text-primary font-semibold">Failed to load PDF</p>
                                <p className="text-xs text-tertiary mt-1">This might be due to CORS or a private file.</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => window.open(url, '_blank')}>
                                Open in new tab
                            </Button>
                        </div>
                    }
                >
                    {numPages && Array.from(new Array(numPages), (el, index) => (
                        <div key={`page_${index + 1}`} className="shadow-xl rounded-sm overflow-hidden mb-4 last:mb-0">
                            <Page
                                pageNumber={index + 1}
                                width={containerWidth ? containerWidth - 32 : 550}
                                renderAnnotationLayer={false}
                                renderTextLayer={false}
                            />
                        </div>
                    ))}
                </Document>
            </div>
        </div>
    );
};
