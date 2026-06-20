import type { Meta, StoryObj } from "@storybook/react";
import { MetricCard } from "./MetricCard";

const meta: Meta<typeof MetricCard> = {
  title: "Components/MetricCard",
  component: MetricCard,
  parameters: { layout: "padded" },
  args: { label: "Monthly rent roll", value: "£3,350", sub: "3 of 3 occupied" },
};
export default meta;
type Story = StoryObj<typeof MetricCard>;

/** Uppercase grey label + large bold value — the described metric tile. */
export const Default: Story = { args: { tone: "brand" } };

export const WithDelta: Story = {
  args: { label: "Net income (2026/27)", value: "£4,612", tone: "success", delta: { direction: "up", label: "12%" } },
};

export const Arrears: Story = {
  args: { label: "Rent arrears", value: "£1,600", tone: "danger", sub: "Action needed", delta: { direction: "down", label: "1 tenant" } },
};

export const Grid: Story = {
  render: () => (
    <div className="grid w-[760px] max-w-full grid-cols-2 gap-4 sm:grid-cols-4">
      <MetricCard label="Monthly rent roll" value="£3,350" sub="3 of 3 occupied" tone="brand" />
      <MetricCard label="Net income" value="£4,612" tone="success" delta={{ direction: "up", label: "12%" }} />
      <MetricCard label="Rent arrears" value="£1,600" tone="danger" sub="Action needed" />
      <MetricCard label="Estimated tax" value="£1,003" tone="warning" sub="Estimate · not advice" />
    </div>
  ),
};
