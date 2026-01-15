import { Link } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Lightbulb, FileText } from "lucide-react";

interface BlockedStateConfig {
  title: string;
  body: string;
  primaryCta: string;
  primaryCtaHref: string;
  showWhyMatters?: boolean;
}

const BLOCKED_STATES = {
  requirementsNeedsIdea: {
    title: "Start with an idea first",
    body: `The Requirements module builds on a validated idea.

Spending time clarifying the problem, constraints, and intent upfront dramatically improves the quality and usefulness of the requirements document.

Once an idea is validated, requirements become clearer, more complete, and far easier to turn into build-ready instructions.`,
    primaryCta: "Validate an Idea",
    primaryCtaHref: "/ideas",
    showWhyMatters: true,
  },
  promptsNeedsRequirements: {
    title: "Requirements come first",
    body: `Build prompts are generated directly from a locked requirements document.

Without clear, agreed requirements, prompts become generic, inconsistent, and harder to execute in real tools.

Completing the Requirements step ensures the prompts you generate are precise, sequential, and reliable.`,
    primaryCta: "Generate Requirements",
    primaryCtaHref: "/requirements",
    showWhyMatters: true,
  },
} as const;

const WHY_MATTERS_CONTENT = `Each module removes ambiguity from the previous step.

• Ideas clarify what you're building and why
• Requirements define exactly how it should work
• Prompts translate that clarity into executable build steps

Skipping steps increases guesswork and reduces the quality of the final output.`;

interface ModuleBlockedStateProps {
  type: keyof typeof BLOCKED_STATES;
}

export function ModuleBlockedState({ type }: ModuleBlockedStateProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const config = BLOCKED_STATES[type];
  
  const Icon = type === "requirementsNeedsIdea" ? Lightbulb : FileText;

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto p-3 rounded-full bg-muted w-fit mb-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
            {config.body}
          </p>
          
          {config.showWhyMatters && (
            <Collapsible open={whyOpen} onOpenChange={setWhyOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-between text-muted-foreground"
                  data-testid="button-why-matters"
                >
                  <span>Why this matters</span>
                  {whyOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground whitespace-pre-line">
                  {WHY_MATTERS_CONTENT}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Link href={config.primaryCtaHref} className="w-full">
            <Button className="w-full" size="lg" data-testid="button-blocked-cta">
              {config.primaryCta}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
