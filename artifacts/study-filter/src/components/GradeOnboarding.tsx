import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GraduationCap, Check, Lock, Sparkles } from "lucide-react";
import { ALL_GRADES, isGradeAvailable, useGrade } from "@/hooks/use-grade";
import { useLocation } from "wouter";

export function GradeOnboarding() {
  const { needsOnboarding, setGrade } = useGrade();
  const [location] = useLocation();
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  const isAuthPage =
    location.startsWith("/sign-in") || location.startsWith("/sign-up");
  const open = needsOnboarding && !isAuthPage;

  if (!open) return null;

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden gap-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="bg-primary/5 px-6 pt-8 pb-6 text-center border-b border-primary/10">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome to StudyFilter
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Which class are you in? We&rsquo;ll tailor everything to your CBSE
            syllabus.
          </p>
        </div>

        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {ALL_GRADES.map((g) => {
              const available = isGradeAvailable(g);
              const isSelected = selectedGrade === g;
              return (
                <button
                  key={g}
                  type="button"
                  disabled={!available}
                  onClick={() => available && setSelectedGrade(g)}
                  className={[
                    "relative flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all",
                    available
                      ? isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                      : "border-dashed border-border/50 bg-muted/30 cursor-not-allowed opacity-70",
                  ].join(" ")}
                >
                  <span className="text-lg font-bold">Class {g}</span>
                  {available ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3 w-3" /> Available now
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Lock className="h-3 w-3" /> Coming soon
                    </span>
                  )}
                  {isSelected && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            className="w-full h-12 rounded-xl text-base"
            disabled={!selectedGrade}
            onClick={() => {
              if (selectedGrade) setGrade(selectedGrade);
            }}
          >
            Start Studying
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            More classes are on the way. You can change this anytime from the
            menu.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
