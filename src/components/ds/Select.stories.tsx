import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  parameters: { layout: "centered" },
  args: {
    options: [
      { value: "personal", label: "Personal — Default" },
      { value: "business", label: "Walpole Lettings Ltd" },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {};
export const WithPlaceholder: Story = { args: { placeholder: "Choose a portfolio", defaultValue: "" } };
