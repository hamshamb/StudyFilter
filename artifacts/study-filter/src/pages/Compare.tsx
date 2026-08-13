import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Scale, Trophy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCompareAnswers } from "@workspace/api-client-react";
import { PageShell, PageHeader } from "@/components/layout/PageShell";
import { LoadingBlock } from "@/components/ui/primitives";
import { SeoHead } from "@/components/SeoHead";

const formSchema = z.object({
  classLevel: z.string().min(1, "Class is required"),
  subject: z.string().min(1, "Subject is required"),
  chapter: z.string().min(1, "Chapter is required"),
  question: z.string().min(5, "Question is required"),
  sourceA_name: z.string().min(1, "Source name required"),
  sourceA_answer: z.string().min(10, "Answer must be longer"),
  sourceB_name: z.string().min(1, "Source name required"),
  sourceB_answer: z.string().min(10, "Answer must be longer"),
  sourceC_name: z.string().optional(),
  sourceC_answer: z.string().optional(),
});

export default function Compare() {
  const { toast } = useToast();
  const compareMutation = useCompareAnswers();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      classLevel: "10",
      subject: "Science",
      chapter: "",
      question: "",
      sourceA_name: "Textbook",
      sourceA_answer: "",
      sourceB_name: "Study Guide",
      sourceB_answer: "",
      sourceC_name: "Web Search",
      sourceC_answer: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const answers = [
      { sourceName: values.sourceA_name, answer: values.sourceA_answer },
      { sourceName: values.sourceB_name, answer: values.sourceB_answer },
    ];
    
    if (values.sourceC_name && values.sourceC_answer) {
      answers.push({ sourceName: values.sourceC_name, answer: values.sourceC_answer });
    }

    compareMutation.mutate(
      {
        data: {
          classLevel: parseInt(values.classLevel, 10),
          subject: values.subject,
          chapter: values.chapter,
          question: values.question,
          answers,
        },
      },
      {
        onError: () => {
          toast({
            title: "Comparison Failed",
            description: "Could not compare these answers. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <>
      <SeoHead
        title="Compare CBSE answers — StudyFilter"
        description="Compare two or three answers for CBSE accuracy, clarity and exam readiness."
        canonical="/compare"
      />
      <PageShell className="space-y-8">
      <PageHeader
        icon={Scale}
        title="Compare Answers"
        description="Not sure which explanation is best? Paste answers from different sources and they get scored on CBSE accuracy, clarity and exam-readiness."
        className="mb-0"
      />

      <Form {...form}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left/Top: Form */}
          <div className="lg:col-span-4 space-y-6 sticky top-24">
            <Card>
              <CardHeader>
                <CardTitle>Question Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form id="compare-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="classLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Class</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Class" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {["8", "9", "10", "11", "12"].map((c) => (
                                <SelectItem key={c} value={c}>Class {c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Subject" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {["Maths", "Science", "Social Science", "English"].map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="chapter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chapter</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Thermodynamics" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="question"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Question</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What is the question?" className="resize-none h-20" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right/Bottom: Sources & Results */}
          <div className="lg:col-span-8 space-y-6">
            {!compareMutation.data && !compareMutation.isPending && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="p-4 pb-2 bg-muted/30">
                      <FormField
                        control={form.control}
                        name="sourceA_name"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Source A Name</FormLabel>
                            <FormControl>
                              <Input className="font-bold border-transparent bg-transparent px-0 h-8 shadow-none focus-visible:ring-0 text-lg" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardHeader>
                    <CardContent className="p-0 border-t">
                      <FormField
                        control={form.control}
                        name="sourceA_answer"
                        render={({ field }) => (
                          <FormItem className="border-none">
                            <FormControl>
                              <Textarea
                                placeholder="Paste the first answer here..."
                                className="min-h-[200px] border-0 rounded-none focus-visible:ring-0 resize-none p-4"
                                {...field}
                              />
                            </FormControl>
                            <div className="px-4 pb-2"><FormMessage /></div>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-4 pb-2 bg-muted/30">
                      <FormField
                        control={form.control}
                        name="sourceB_name"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Source B Name</FormLabel>
                            <FormControl>
                              <Input className="font-bold border-transparent bg-transparent px-0 h-8 shadow-none focus-visible:ring-0 text-lg" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardHeader>
                    <CardContent className="p-0 border-t">
                      <FormField
                        control={form.control}
                        name="sourceB_answer"
                        render={({ field }) => (
                          <FormItem className="border-none">
                            <FormControl>
                              <Textarea
                                placeholder="Paste the second answer here..."
                                className="min-h-[200px] border-0 rounded-none focus-visible:ring-0 resize-none p-4"
                                {...field}
                              />
                            </FormControl>
                            <div className="px-4 pb-2"><FormMessage /></div>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2 border-dashed bg-muted/10">
                    <CardHeader className="p-4 pb-2">
                      <FormField
                        control={form.control}
                        name="sourceC_name"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Source C Name (Optional)</FormLabel>
                            <FormControl>
                              <Input className="font-bold border-transparent bg-transparent px-0 h-8 shadow-none focus-visible:ring-0 text-lg" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardHeader>
                    <CardContent className="p-0 border-t border-dashed">
                      <FormField
                        control={form.control}
                        name="sourceC_answer"
                        render={({ field }) => (
                          <FormItem className="border-none">
                            <FormControl>
                              <Textarea
                                placeholder="Paste a third answer to compare..."
                                className="min-h-[120px] bg-transparent border-0 rounded-none focus-visible:ring-0 resize-none p-4"
                                {...field}
                              />
                            </FormControl>
                            <div className="px-4 pb-2"><FormMessage /></div>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>

                <Button
                  type="submit"
                  form="compare-form"
                  size="lg"
                  className="w-full h-14 text-lg shadow-md"
                >
                  <Scale className="mr-2 h-5 w-5" /> Score & Compare Answers
                </Button>
              </div>
            )}

            {compareMutation.isPending && (
              <div className="rounded-xl border border-card-border bg-card">
                <LoadingBlock
                  full
                  label="Scoring each answer on CBSE accuracy, clarity and exam-readiness…"
                />
              </div>
            )}

            {compareMutation.data && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Comparison Results</h2>
                  <Button variant="outline" onClick={() => compareMutation.reset()}>Compare Again</Button>
                </div>

                <div className="relative overflow-hidden p-6 bg-primary/5 border border-primary/20 rounded-xl flex flex-col md:flex-row gap-6 items-center dark:bg-primary/8 dark:border-primary/25">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  <div className="flex-shrink-0 h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center dark:bg-primary/15">
                    <Trophy className="h-10 w-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Best Answer</h3>
                    <p className="text-2xl font-bold text-primary mb-2">{compareMutation.data.bestSource}</p>
                    <p className="text-muted-foreground">{compareMutation.data.reasoning}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compareMutation.data.scores.map((score, idx) => {
                    const isWinner = score.sourceName === compareMutation.data.bestSource;
                    return (
                      <Card key={idx} className={`relative overflow-hidden ${isWinner ? 'border-primary shadow-md ring-1 ring-primary/20 dark:shadow-[0_0_24px_-8px_hsl(var(--primary)/0.35)]' : 'dark:border-border/60'}`}>
                        {isWinner && (
                          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"></div>
                        )}
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg line-clamp-1">{score.sourceName}</CardTitle>
                            {isWinner && <Badge className="bg-primary hover:bg-primary">Winner</Badge>}
                          </div>
                          <div className="text-4xl font-bold pt-2">{score.total}<span className="text-lg text-muted-foreground font-sans">/100</span></div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-muted-foreground">CBSE Match</span>
                              <span>{score.cbseMatch}/20</span>
                            </div>
                            <Progress value={(score.cbseMatch / 20) * 100} className="h-1.5" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-muted-foreground">Correctness</span>
                              <span>{score.correctnessEstimate}/20</span>
                            </div>
                            <Progress value={(score.correctnessEstimate / 20) * 100} className="h-1.5" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-muted-foreground">Clarity</span>
                              <span>{score.clarity}/20</span>
                            </div>
                            <Progress value={(score.clarity / 20) * 100} className="h-1.5" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-muted-foreground">Simple Language</span>
                              <span>{score.simpleLanguage}/20</span>
                            </div>
                            <Progress value={(score.simpleLanguage / 20) * 100} className="h-1.5" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-muted-foreground">Exam Readiness</span>
                              <span>{score.examReadiness}/20</span>
                            </div>
                            <Progress value={(score.examReadiness / 20) * 100} className="h-1.5" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {compareMutation.data.finalAnswer && (
                  <Card className="border-2 border-primary/20 relative overflow-hidden dark:border-primary/25">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                    <CardHeader className="bg-primary/5 border-b border-primary/10 dark:bg-primary/8 dark:border-primary/15">
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" /> Synthesized Ideal Answer
                      </CardTitle>
                      <CardDescription>The best parts of all answers combined into one perfect response.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <p className="text-lg leading-relaxed">{compareMutation.data.finalAnswer}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </Form>
      </PageShell>
    </>
  );
}
