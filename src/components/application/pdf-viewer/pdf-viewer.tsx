"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, File as File02, RefreshCw as RefreshCw01 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";

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

    const filename = title || decodeURIComponent(url.split("/").pop()?.split("-").slice(1).join("-") || "Document.pdf");

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
        <div className="flex w-full flex-col gap-0 rounded-xl border border-secondary bg-secondary/5" ref={setContainerRef}>
            <div className="flex items-center justify-between rounded-t-xl border-b border-secondary bg-primary p-3">
                <div className="flex flex-col gap-0.5">
                    <div className="max-w-[300px] truncate text-sm font-semibold text-primary sm:max-w-md">{filename}</div>
                    <div className="text-[10px] font-bold tracking-widest text-tertiary uppercase">{numPages || "--"} Pages</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => window.open(url, "_blank")}>
                    <ArrowUpRight className="size-4" />
                    Open
                </Button>
            </div>

            <div className="flex max-h-[500px] min-h-[250px] flex-col items-center gap-4 overflow-auto bg-secondary/10 p-4">
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                        <div className="flex flex-col items-center justify-center gap-3 p-20">
                            <RefreshCw01 className="size-6 animate-spin text-brand-solid" />
                            <p className="text-sm font-medium text-tertiary">Loading PDF...</p>
                        </div>
                    }
                    error={
                        <div className="flex flex-col items-center gap-3 p-12 text-center">
                            <div className="rounded-full bg-error-primary/10 p-3 text-error-primary">
                                <File02 className="size-6" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-primary">Failed to load PDF</p>
                                <p className="mt-1 text-xs text-tertiary">This might be due to CORS or a private file.</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => window.open(url, "_blank")}>
                                Open in new tab
                            </Button>
                        </div>
                    }
                >
                    {numPages &&
                        Array.from(new Array(numPages), (el, index) => (
                            <div key={`page_${index + 1}`} className="mb-4 overflow-hidden rounded-sm shadow-xl last:mb-0">
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
