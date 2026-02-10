import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  BookOpen,
  Lock,
  CheckCircle,
  Send,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { IdeaAnalysis } from "@shared/types/ideas";
import { apiRequest } from "@/lib/queryClient";

interface ConversationTurn {
  question: string;
  answer: string;
  turnNumber: number;
}

interface WorkshopConversationProps {
  analysis: IdeaAnalysis;
  researchBrief?: string;
  onComplete: (turns: ConversationTurn[]) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function WorkshopConversation({
  analysis,
  researchBrief,
  onComplete,
  onCancel,
  isSubmitting,
}: WorkshopConversationProps) {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [shouldComplete, setShouldComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchNextQuestion([]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, currentQuestion, isLoadingQuestion]);

  useEffect(() => {
    if (currentQuestion && !isLoadingQuestion && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentQuestion, isLoadingQuestion]);

  const fetchNextQuestion = async (history: ConversationTurn[]) => {
    setIsLoadingQuestion(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/ideas/workshop/next", {
        analysis,
        conversationHistory: history,
        researchBrief,
      });

      const data = await response.json() as {
        success: boolean;
        data: {
          question: string;
          turnNumber: number;
          shouldComplete: boolean;
          reasoning: string;
        };
      };

      if (data.success) {
        if (data.data.shouldComplete && history.length >= 3) {
          setShouldComplete(true);
          setCurrentQuestion("");
        } else {
          setCurrentQuestion(data.data.question);
          setShouldComplete(false);
        }
      } else {
        throw new Error("Failed to get next question");
      }
    } catch (err) {
      console.error("Workshop question error:", err);
      setError("Failed to generate the next question. You can try again or complete the workshop with your current answers.");
      setShouldComplete(true);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || !currentQuestion) return;

    const newTurn: ConversationTurn = {
      question: currentQuestion,
      answer: currentAnswer.trim(),
      turnNumber: turns.length + 1,
    };

    const updatedTurns = [...turns, newTurn];
    setTurns(updatedTurns);
    setCurrentAnswer("");
    setCurrentQuestion("");

    await fetchNextQuestion(updatedTurns);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const handleComplete = () => {
    if (currentAnswer.trim() && currentQuestion) {
      const finalTurn: ConversationTurn = {
        question: currentQuestion,
        answer: currentAnswer.trim(),
        turnNumber: turns.length + 1,
      };
      onComplete([...turns, finalTurn]);
    } else {
      onComplete(turns);
    }
  };

  const canComplete = turns.length >= 3;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                AI Refinement Interview
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                The AI will ask targeted questions based on your analysis findings. Each question adapts to your previous answers.
              </p>
            </div>
            <Badge variant="outline" className="gap-1" data-testid="badge-turn-count">
              {turns.length} question{turns.length !== 1 ? "s" : ""} answered
            </Badge>
          </div>
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

      <Card>
        <CardContent className="p-0">
          <div
            ref={scrollRef}
            className="max-h-[500px] overflow-y-auto p-6 space-y-6"
            data-testid="workshop-conversation-area"
          >
            {turns.map((turn, index) => (
              <div key={index} className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">AI Question {turn.turnNumber}</p>
                    <p className="text-sm">{turn.question}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Your Answer</p>
                    <p className="text-sm whitespace-pre-wrap">{turn.answer}</p>
                  </div>
                </div>

                {index < turns.length - 1 && <Separator />}
              </div>
            ))}

            {isLoadingQuestion && (
              <div className="flex gap-3" data-testid="workshop-loading-question">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">AI is thinking...</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reviewing your answers and generating the next question...
                  </div>
                </div>
              </div>
            )}

            {!isLoadingQuestion && currentQuestion && (
              <div className="space-y-4">
                {turns.length > 0 && <Separator />}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">AI Question {turns.length + 1}</p>
                    <p className="text-sm" data-testid="workshop-current-question">{currentQuestion}</p>
                  </div>
                </div>

                <div className="pl-11 space-y-3">
                  <Textarea
                    ref={textareaRef}
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Be specific — concrete details, names, numbers, and evidence help the AI ask better follow-ups..."
                    className="min-h-[100px]"
                    onKeyDown={handleKeyDown}
                    data-testid="workshop-answer-input"
                  />
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      Press Ctrl+Enter to submit
                    </p>
                    <Button
                      onClick={handleSubmitAnswer}
                      disabled={!currentAnswer.trim() || isLoadingQuestion}
                      data-testid="workshop-submit-answer"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Submit Answer
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!isLoadingQuestion && shouldComplete && turns.length > 0 && (
              <div className="space-y-3">
                {turns.length > 0 && <Separator />}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">AI Assessment</p>
                    <p className="text-sm">
                      I've gathered enough context to significantly improve the analysis. The key risks and assumptions have been addressed. Ready to re-analyze with your input.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="workshop-error">
                {error}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-4 flex-wrap border-t p-4">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="button-workshop-cancel"
          >
            Cancel Workshop
          </Button>

          <div className="flex gap-2">
            {canComplete && !shouldComplete && !isLoadingQuestion && currentQuestion && (
              <Button
                variant="outline"
                onClick={handleComplete}
                disabled={isSubmitting || isLoadingQuestion}
                data-testid="button-workshop-complete-early"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete & Re-analyze
              </Button>
            )}

            {(shouldComplete || (!currentQuestion && !isLoadingQuestion && canComplete)) && (
              <Button
                onClick={handleComplete}
                disabled={isSubmitting || turns.length === 0}
                data-testid="button-workshop-complete"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete & Re-analyze
                  </>
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
