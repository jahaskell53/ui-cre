"use client";

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, RefreshCw01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
    url: string;
}

export const PdfViewer = ({ url }: PdfViewerProps) => {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [containerWidth, setContainerWidth] = useState<number | null>(null);
    const [isMounted, setIsMounted] = useState(false);

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
                <div className="text-xs font-semibold text-secondary">
                    Page {pageNumber} <span className="text-tertiary">of</span> {numPages || '--'}
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        color="secondary"
                        onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                        isDisabled={pageNumber <= 1}
                        className="p-1!"
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                        size="sm"
                        color="secondary"
                        onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || prev))}
                        isDisabled={numPages ? pageNumber >= numPages : true}
                        className="p-1!"
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            <div className="flex justify-center p-4 bg-secondary/10 overflow-auto max-h-[600px] min-h-[400px]">
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
                            <Button size="sm" color="secondary" onClick={() => window.open(url, '_blank')}>
                                Open in new tab
                            </Button>
                        </div>
                    }
                >
                    <Page
                        pageNumber={pageNumber}
                        width={containerWidth ? containerWidth - 32 : 550}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        className="shadow-xl rounded-sm overflow-hidden"
                    />
                </Document>
            </div>
        </div>
    );
};

// Import helper for cleaner page.tsx
import { File02 } from '@untitledui/icons';
