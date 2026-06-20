import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardBody, CardFooter } from "./Card";
import { Button } from "./Button";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[480px] max-w-full">
      <CardHeader title="Recent transactions" subtitle="From your bank feed" action={<Button variant="outline" size="sm">View all</Button>} />
      <CardBody>
        <p className="text-sm text-slate-600">White card with soft rounded corners and a subtle shadow.</p>
      </CardBody>
      <CardFooter>
        <Button variant="ghost" size="sm">Dismiss</Button>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  ),
};
