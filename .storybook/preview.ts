import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#f8fafc" }, // slate-50 app background
        { name: "white", value: "#ffffff" },
      ],
    },
    options: {
      storySort: { order: ["Foundations", "Components"] },
    },
  },
};

export default preview;
