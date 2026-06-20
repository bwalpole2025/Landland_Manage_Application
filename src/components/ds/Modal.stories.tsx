import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

const meta: Meta<typeof Modal> = {
  title: "Components/Modal",
  component: Modal,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Modal>;

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Archive property?"
        description="Oakfield Road will be hidden from your active portfolio. You can restore it later."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Archive</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Archiving keeps all transactions and documents intact.</p>
      </Modal>
    </>
  );
}

export const Default: Story = { render: () => <ModalDemo /> };
