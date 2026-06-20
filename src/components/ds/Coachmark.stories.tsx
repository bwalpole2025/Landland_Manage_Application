import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Coachmark, useCoachmark } from "./Coachmark";
import { Button } from "./Button";

const meta: Meta<typeof Coachmark> = {
  title: "Components/Coachmark",
  component: Coachmark,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Coachmark>;

function CoachmarkDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      {!open ? <Button onClick={() => setOpen(true)}>Replay coachmark</Button> : null}
      <Coachmark
        open={open}
        title="Welcome to Transactions"
        media={<span className="text-3xl">💸</span>}
        onConfirm={() => setOpen(false)}
        onDontShowAgain={() => setOpen(false)}
      >
        Your bank feed imports transactions automatically. Assign each one to a property and
        category, then mark it reconciled.
      </Coachmark>
    </>
  );
}

/** Simple controlled coachmark. */
export const Default: Story = { render: () => <CoachmarkDemo /> };

function FirstVisitDemo() {
  const mark = useCoachmark("storybook-demo-section");
  return (
    <div className="space-y-3 text-center">
      <Button onClick={() => mark.setOpen(true)}>Show</Button>
      <Button variant="ghost" onClick={mark.reset}>Reset “don’t show again”</Button>
      <Coachmark
        open={mark.open}
        title="Your properties"
        onConfirm={mark.close}
        onDontShowAgain={mark.dontShowAgain}
      >
        This panel only appears on your first visit. Choose “Don’t show again” to dismiss it for good.
      </Coachmark>
    </div>
  );
}

/**
 * First-visit pattern with the `useCoachmark` hook: shows once, and "Don't show
 * again" persists the dismissal in localStorage (keyed per section).
 */
export const FirstVisitPattern: Story = { render: () => <FirstVisitDemo /> };
