import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
  BookOpen,
  Target,
  Crosshair,
  Scale,
  Lock,
} from "lucide-react";
import type { WorkshopSection, WorkshopQuestion, WorkshopAnswer } from "@shared/types/workshop";
import type { IdeaAnalysis } from "@shared/types/ideas";

interface WorkshopFormProps {
  analysis: IdeaAnalysis;
  sections: WorkshopSection[];
  onComplete: (answers: WorkshopAnswer[]) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function getSectionIcon(type: string) {
  switch (type) {
    case "target_market_clarity":
      return <Target className="h-5 w-5" />;
    case "pain_urgency_validation":
      return <AlertTriangle className="h-5 w-5" />;
    case "scope_boundaries":
      return <Crosshair className="h-5 w-5" />;
    case "constraints_resources":
      return <Scale className="h-5 w-5" />;
    default:
      return <BookOpen className="h-5 w-5" />;
  }
}

function QuestionRenderer({
  question,
  value,
  onChange,
}: {
  question: WorkshopQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  switch (question.questionType) {
    case "single_select":
    case "banded_range":
      return (
        <RadioGroup
          value={value as string}
          onValueChange={onChange}
          className="space-y-2"
        >
          {question.options?.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer"
            >
              <RadioGroupItem
                value={option.value}
                id={`${question.id}_${option.value}`}
                data-testid={`radio-${question.id}-${option.value}`}
              />
              <Label
                htmlFor={`${question.id}_${option.value}`}
                className="cursor-pointer flex-1"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "multi_select":
      const selectedValues = (value as string[]) || [];
      return (
        <div className="space-y-2">
          {question.options?.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer"
            >
              <Checkbox
                id={`${question.id}_${option.value}`}
                checked={selectedValues.includes(option.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selectedValues, option.value]);
                  } else {
                    onChange(selectedValues.filter((v) => v !== option.value));
                  }
                }}
                data-testid={`checkbox-${question.id}-${option.value}`}
              />
              <Label
                htmlFor={`${question.id}_${option.value}`}
                className="cursor-pointer flex-1"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      );

    case "short_text":
      return (
        <Textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here..."
          className="min-h-[100px] resize-none"
          data-testid={`textarea-${question.id}`}
        />
      );

    default:
      return null;
  }
}

export function WorkshopForm({
  analysis,
  sections,
  onComplete,
  onCancel,
  isSubmitting,
}: WorkshopFormProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const currentSection = sections[currentSectionIndex];
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const answeredQuestions = Object.keys(answers).filter(
    (key) => answers[key] && (typeof answers[key] === "string" ? answers[key] !== "" : (answers[key] as string[]).length > 0)
  ).length;
  const progress = (answeredQuestions / totalQuestions) * 100;

  const isCurrentSectionComplete = () => {
    return currentSection.questions.every((q) => {
      if (!q.required) return true;
      const answer = answers[q.id];
      if (!answer) return false;
      if (typeof answer === "string") return answer.trim() !== "";
      return answer.length > 0;
    });
  };

  const canGoNext = currentSectionIndex < sections.length - 1;
  const canGoBack = currentSectionIndex > 0;
  const isLastSection = currentSectionIndex === sections.length - 1;

  const handleNext = () => {
    if (canGoNext) {
      setCurrentSectionIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (canGoBack) {
      setCurrentSectionIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    const workshopAnswers: WorkshopAnswer[] = Object.entries(answers).map(
      ([questionId, value]) => ({
        questionId,
        value,
      })
    );
    onComplete(workshopAnswers);
  };

  const updateAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Guided Refinement Workshop
              </CardTitle>
              <CardDescription>
                Answer these structured questions to improve your idea before re-analysis.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              {answeredQuestions}/{totalQuestions} answered
            </Badge>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            Original Idea (Read-only)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="font-medium">{analysis.input.title}</p>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {analysis.input.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {sections.map((section, index) => {
          const isCurrent = index === currentSectionIndex;
          const isComplete = section.questions.every((q) => {
            if (!q.required) return true;
            const answer = answers[q.id];
            if (!answer) return false;
            if (typeof answer === "string") return answer.trim() !== "";
            return answer.length > 0;
          });

          return (
            <button
              key={section.type}
              onClick={() => setCurrentSectionIndex(index)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                    : "bg-muted hover-elevate"
              }`}
              data-testid={`section-nav-${section.type}`}
            >
              {isComplete ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                getSectionIcon(section.type)
              )}
              <span className="text-sm font-medium">{section.title}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              {getSectionIcon(currentSection.type)}
            </div>
            <div>
              <CardTitle className="text-lg">{currentSection.title}</CardTitle>
              <CardDescription>{currentSection.description}</CardDescription>
            </div>
          </div>
          {currentSection.triggerReason && (
            <Badge variant="secondary" className="mt-2 w-fit">
              Why this section: {currentSection.triggerReason}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {currentSection.questions.map((question, qIndex) => (
            <div key={question.id} className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                  {qIndex + 1}
                </span>
                <div className="space-y-1 flex-1">
                  <p className="font-medium">
                    {question.prompt}
                    {question.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="ml-8">
                <QuestionRenderer
                  question={question}
                  value={answers[question.id]}
                  onChange={(value) => updateAnswer(question.id, value)}
                />
              </div>
              {qIndex < currentSection.questions.length - 1 && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex justify-between gap-4 flex-wrap">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={!canGoBack}
              data-testid="button-workshop-back"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              variant="ghost"
              onClick={onCancel}
              data-testid="button-workshop-cancel"
            >
              Cancel Workshop
            </Button>
          </div>

          {isLastSection ? (
            <Button
              onClick={handleComplete}
              disabled={!isCurrentSectionComplete() || isSubmitting}
              data-testid="button-workshop-complete"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Re-analyzing...
                </>
              ) : (
                <>
                  Complete & Re-analyze
                  <CheckCircle className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!isCurrentSectionComplete()}
              data-testid="button-workshop-next"
            >
              Next Section
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
