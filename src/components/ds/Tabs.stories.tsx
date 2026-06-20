import type { Meta, StoryObj } from "@storybook/react";
import { Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <div className="w-[560px] max-w-full">
      <Tabs
        items={[
          { id: "overview", label: "Overview" },
          { id: "transactions", label: "Transactions", badge: 12 },
          { id: "documents", label: "Documents" },
          { id: "notes", label: "Notes" },
        ]}
        defaultValue="transactions"
      />
    </div>
  ),
};
