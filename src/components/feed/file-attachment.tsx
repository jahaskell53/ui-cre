import { File } from "lucide-react";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("@/components/application/pdf-viewer/pdf-viewer").then((mod) => mod.PdfViewer), {
    ssr: false,
    loading: () => (
        <div className="flex h-[400px] w-full animate-pulse items-center justify-center rounded-xl border border-secondary bg-secondary/10 text-tertiary">
            Loading viewer...
        </div>
    ),
});

interface FileAttachmentProps {
    fileUrl: string;
}

export const FileAttachment = ({ fileUrl }: FileAttachmentProps) => {
    const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i);
    const isPdf = fileUrl.toLowerCase().endsWith(".pdf");

    if (isImage) {
        return (
            <div className="overflow-hidden rounded-xl border border-secondary bg-secondary/10">
                <img src={fileUrl} alt="Post attachment" className="mx-auto max-h-[500px] w-full object-contain" />
            </div>
        );
    }

    if (isPdf) {
        return (
            <div className="w-full duration-300 animate-in fade-in slide-in-from-top-2">
                <PdfViewer url={fileUrl} />
            </div>
        );
    }

    return (
        <div className="group flex items-center gap-3 rounded-xl border border-secondary bg-secondary/5 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg border border-secondary bg-primary text-tertiary">
                <File className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-primary">
                    {decodeURIComponent(fileUrl.split("/").pop()?.split("-").slice(1).join("-") || "Attachment")}
                </p>
                <p className="text-xs tracking-wider text-tertiary uppercase">{fileUrl.split(".").pop()?.toUpperCase()} File</p>
            </div>
        </div>
    );
};
