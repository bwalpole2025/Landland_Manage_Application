import type { Meta, StoryObj } from "@storybook/react";
import { Banner } from "./Banner";
import { Button } from "./Button";

const meta: Meta<typeof Banner> = {
  title: "Components/Banner",
  component: Banner,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Banner>;

export const Trial: Story = {
  render: () => (
    <div className="w-[680px] max-w-full">
      <Banner tone="warning" title="You're on a free trial" action={<Button size="sm" variant="secondary">Upgrade</Button>}>
        14 days left. Add a payment method to keep your data after the trial ends.
      </Banner>
    </div>
  ),
};

export const AllTones: Story = {
  render: () => (
    <div className="w-[680px] max-w-full space-y-3">
      <Banner tone="info" title="MTD ready">Keep digital records and file quarterly updates with HMRC.</Banner>
      <Banner tone="success" title="Update submitted">Your Q4 quarterly update was accepted by HMRC.</Banner>
      <Banner tone="warning" title="Certificate expiring">Gas safety for Oakfield Road expires in 7 days.</Banner>
      <Banner tone="danger" title="Rent overdue" dismissible>Station Mews is one month in arrears (£1,600).</Banner>
    </div>
  ),
};
