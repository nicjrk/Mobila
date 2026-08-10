import { useState } from "react";
import { ArrowRight, Check, MousePointer2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STEPS = [
  {
    title: "Choose your project type",
    description:
      "Start with Modular for freestanding cabinets or Under-Stairs for the space beneath a staircase.",
    icon: Sparkles,
  },
  {
    title: "Add your units",
    description:
      "Use Add left, Add right, or Duplicate selected. The new unit is selected automatically.",
    icon: MousePointer2,
  },
  {
    title: "Configure and save",
    description:
      "Edit dimensions, finishes, and accessories, then save the design or send a link to your client.",
    icon: Check,
  },
] as const;

export default function OnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const Icon = current.icon;

  const close = () => {
    try {
      window.localStorage.setItem("wardrobe-onboarding-v1", "done");
    } catch {
      // Onboarding can still be dismissed when storage is unavailable.
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
            <Icon className="size-5" />
          </div>
          <DialogTitle className="font-display text-xl">Design your wardrobe</DialogTitle>
          <DialogDescription>
            {current.title}. {current.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((item, index) => (
            <div
              key={item.title}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
        <DialogFooter className="mt-2 flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={close}>
            Skip
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((value) => value + 1)}>
              Next <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button onClick={close}>Start designing</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
