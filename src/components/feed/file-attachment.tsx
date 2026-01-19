import { File } from "lucide-react";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("@/components/base/pdf-viewer/pdf-viewer").then(mod => mod.PdfViewer), {
    ssr: false,
    loading: () => <div className="w-full h-[400px] border border-secondary rounded-xl animate-pulse bg-secondary/10 flex items-center justify-center text-tertiary">Loading viewer...</div>
});

interface FileAttachmentProps {
    fileUrl: string;
}

export const FileAttachment = ({ fileUrl }: FileAttachmentProps) => {
    const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i);
    const isPdf = fileUrl.toLowerCase().endsWith('.pdf');

    if (isImage) {
        return (
            <div className="border border-secondary rounded-xl overflow-hidden bg-secondary/10">
                <img
                    src={fileUrl}
                    alt="Post attachment"
                    className="w-full max-h-[500px] object-contain mx-auto"
                />
            </div>
        );
    }

    if (isPdf) {
        return (
            <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
                <PdfViewer url={fileUrl} />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 p-4 border border-secondary rounded-xl bg-secondary/5 group">
            <div className="size-10 rounded-lg bg-primary border border-secondary flex items-center justify-center text-tertiary">
                <File className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">
                    {decodeURIComponent(fileUrl.split('/').pop()?.split('-').slice(1).join('-') || "Attachment")}
                </p>
                <p className="text-xs text-tertiary uppercase tracking-wider">
                    {fileUrl.split('.').pop()?.toUpperCase()} File
                </p>
            </div>
        </div>
    );
};
