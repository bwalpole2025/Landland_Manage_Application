import type { Meta, StoryObj } from "@storybook/react";
import { SidebarNavItem } from "./SidebarNavItem";
import { DashboardIcon, PropertyIcon, TransactionsIcon, FilesIcon } from "@/components/icons";

const meta: Meta<typeof SidebarNavItem> = {
  title: "Components/SidebarNavItem",
  component: SidebarNavItem,
  parameters: { layout: "padded", backgrounds: { default: "white" } },
};
export default meta;
type Story = StoryObj<typeof SidebarNavItem>;

export const Nav: Story = {
  render: () => (
    <nav className="w-60 space-y-1 rounded-card border border-slate-200 bg-white p-3">
      <SidebarNavItem icon={<DashboardIcon />} label="Dashboard" active />
      <SidebarNavItem icon={<PropertyIcon />} label="My Properties" />
      <SidebarNavItem icon={<TransactionsIcon />} label="Transactions" badge={2} />
      <SidebarNavItem icon={<FilesIcon />} label="Files & Dates" />
    </nav>
  ),
};
