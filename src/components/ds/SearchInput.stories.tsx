import type { Meta, StoryObj } from "@storybook/react";
import { SearchInput } from "./SearchInput";

const meta: Meta<typeof SearchInput> = {
  title: "Components/SearchInput",
  component: SearchInput,
  parameters: { layout: "centered" },
  args: { placeholder: "Search transactions…", containerClassName: "w-80" },
};
export default meta;
type Story = StoryObj<typeof SearchInput>;

export const Default: Story = {};
