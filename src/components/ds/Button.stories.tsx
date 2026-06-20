import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { PlusIcon } from "@/components/icons";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  args: { children: "Add property" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "outline", "ghost"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

/** Primary = vivid purple, pill-shaped. Matches the described primary button style. */
export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Import file" } };
export const Outline: Story = { args: { variant: "outline", children: "Cancel" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Skip" } };

export const WithIcon: Story = {
  args: { variant: "primary", leftIcon: <PlusIcon width={16} height={16} /> },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="primary" disabled>Disabled</Button>
    </div>
  ),
};
