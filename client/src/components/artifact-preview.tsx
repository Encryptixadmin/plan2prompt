import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Clock, Hash, User } from "lucide-react";
import type { ArtifactMetadata, ArtifactSection } from "@shared/types/artifact";

interface ArtifactPreviewProps {
  title: string;
  metadata?: Partial<ArtifactMetadata>;
  sections?: ArtifactSection[];
  rawContent?: string;
  maxHeight?: string;
  showMetadata?: boolean;
}

function renderMarkdownLine(line: string): React.ReactNode {
  if (line.startsWith("### ")) {
    return <h3 className="text-base font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
  }
  if (line.startsWith("## ")) {
    return <h2 className="text-lg font-semibold mt-5 mb-2">{line.slice(3)}</h2>;
  }
  if (line.startsWith("# ")) {
    return <h1 className="text-xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
  }
  if (line.startsWith("- ")) {
    return <li className="ml-4 list-disc">{line.slice(2)}</li>;
  }
  if (line.startsWith("* ")) {
    return <li className="ml-4 list-disc">{line.slice(2)}</li>;
  }
  if (/^\d+\.\s/.test(line)) {
    const content = line.replace(/^\d+\.\s/, "");
    return <li className="ml-4 list-decimal">{content}</li>;
  }
  if (line.startsWith("> ")) {
    return (
      <blockquote className="border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground">
        {line.slice(2)}
      </blockquote>
    );
  }
  if (line.startsWith("```")) {
    return null;
  }
  if (line.trim() === "") {
    return <div className="h-2" />;
  }
  return <p className="text-sm text-foreground/90 leading-relaxed">{line}</p>;
}

function SimpleMarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeContent: string[] = [];

  const elements: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${index}`}
            className="bg-muted p-3 rounded-md text-xs overflow-x-auto my-2 font-mono"
          >
            {codeContent.join("\n")}
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      return;
    }

    const rendered = renderMarkdownLine(line);
    if (rendered) {
      elements.push(<div key={index}>{rendered}</div>);
    }
  });

  return <div className="space-y-1">{elements}</div>;
}

export function ArtifactPreview({
  title,
  metadata,
  sections,
  rawContent,
  maxHeight = "400px",
  showMetadata = true,
}: ArtifactPreviewProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const content = rawContent || sections?.map((s) => `${"#".repeat(s.level)} ${s.heading}\n\n${s.content}`).join("\n\n") || "";

  const bodyContent = content
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/## AI Notes[\s\S]*$/, "")
    .trim();

  return (
    <div className="border rounded-lg bg-card" data-testid="artifact-preview">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{title}</span>
          </div>
          {showMetadata && metadata && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {metadata.version && (
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  <span>v{metadata.version}</span>
                </div>
              )}
              {metadata.createdAt && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(metadata.createdAt)}</span>
                </div>
              )}
              {metadata.author && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{metadata.author}</span>
                </div>
              )}
              {metadata.stage && (
                <Badge variant="outline" className="text-xs capitalize">
                  {metadata.stage}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      <ScrollArea style={{ maxHeight }} className="p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <SimpleMarkdownRenderer content={bodyContent} />
        </div>
      </ScrollArea>
    </div>
  );
}

interface VersionSelectorProps {
  versions: Array<{
    version: number;
    createdAt: string;
    isActive?: boolean;
  }>;
  currentVersion: number;
  onVersionChange: (version: number) => void;
}

export function VersionSelector({
  versions,
  currentVersion,
  onVersionChange,
}: VersionSelectorProps) {
  if (versions.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm" data-testid="version-selector">
      <span className="text-muted-foreground">Version:</span>
      <div className="flex gap-1">
        {versions.map((v) => (
          <button
            key={v.version}
            onClick={() => onVersionChange(v.version)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              v.version === currentVersion
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover-elevate"
            }`}
            data-testid={`button-version-${v.version}`}
          >
            v{v.version}
            {v.isActive && " (active)"}
          </button>
        ))}
      </div>
    </div>
  );
}
