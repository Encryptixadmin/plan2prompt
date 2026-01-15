import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  GitBranch, 
  FileText, 
  ChevronRight,
  History,
  Loader2,
} from "lucide-react";
import type { ArtifactVersion } from "@shared/types/artifact";

interface VersionHistoryPanelProps {
  artifactId: string;
  currentVersion: number;
  onSelectVersion?: (version: ArtifactVersion) => void;
  onCompareVersions?: (v1: ArtifactVersion, v2: ArtifactVersion) => void;
}

export function VersionHistoryPanel({
  artifactId,
  currentVersion,
  onSelectVersion,
}: VersionHistoryPanelProps) {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: ArtifactVersion[] }>({
    queryKey: ["/api/artifacts", artifactId, "versions"],
  });

  const versions = data?.data || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !versions.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No version history available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Version History
        </CardTitle>
        <CardDescription>
          All versions are preserved. Select a version to view its contents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {versions.map((version, index) => {
            const isCurrent = version.version === currentVersion;
            const isFirst = index === 0;
            const isLast = index === versions.length - 1;

            return (
              <div key={version.id}>
                <button
                  onClick={() => onSelectVersion?.(version)}
                  className={`w-full p-3 rounded-md text-left transition-colors hover-elevate ${
                    isCurrent 
                      ? "bg-primary/10 border border-primary/20" 
                      : "border border-transparent"
                  }`}
                  data-testid={`button-version-${version.version}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {version.version}</span>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-xs">Current</Badge>
                          )}
                          {isFirst && !isCurrent && (
                            <Badge variant="outline" className="text-xs">Original</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          {new Date(version.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
                {!isLast && <Separator className="my-2" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface VersionCompareProps {
  version1: { version: number; content: string };
  version2: { version: number; content: string };
  onClose: () => void;
}

export function VersionComparePanel({ version1, version2, onClose }: VersionCompareProps) {
  const lines1 = version1.content.split("\n");
  const lines2 = version2.content.split("\n");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Compare Versions
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-close-compare">
            Close
          </Button>
        </div>
        <CardDescription>
          Text-only comparison between Version {version1.version} and Version {version2.version}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Badge variant="outline">v{version1.version}</Badge>
              Older
            </div>
            <div className="p-3 rounded-md bg-muted text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96">
              {lines1.slice(0, 50).join("\n")}
              {lines1.length > 50 && "\n... (truncated)"}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Badge variant="outline">v{version2.version}</Badge>
              Newer
            </div>
            <div className="p-3 rounded-md bg-muted text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96">
              {lines2.slice(0, 50).join("\n")}
              {lines2.length > 50 && "\n... (truncated)"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
