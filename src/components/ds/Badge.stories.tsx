import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  args: { children: "Occupied", tone: "brand" },
  argTypes: { tone: { control: "select", options: ["brand", "accent", "neutral", "success", "warning", "danger"] } },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="brand">Active</Badge>
      <Badge tone="accent">Imported</Badge>
      <Badge tone="neutral">Vacant</Badge>
      <Badge tone="success">Up to date</Badge>
      <Badge tone="warning">Trial</Badge>
      <Badge tone="danger">Arrears</Badge>
    </div>
  ),
};
