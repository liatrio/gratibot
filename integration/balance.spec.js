const { test, expect } = require("@playwright/test");

test("balance", async ({ page }) => {
  const { SLACK_USERNAME: username, SLACK_PASSWORD: password } = process.env;
  await page.goto("https://gratibot-lab.slack.com/sign_in_with_password");

  await page.getByRole("textbox", { name: "email" }).fill(username);
  await page.getByRole("textbox", { name: "password" }).fill(password);

  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  await page.getByRole("textbox").waitFor();

  await page.getByRole("textbox").type("@alexa-gratibot-2");
  await page.getByRole("listbox").waitFor();

  await page.getByRole("textbox").press("Enter");
  await page.getByRole("textbox").type("balance");

  await page.getByRole("button", { name: "Send now" }).click();

  await page.getByText("Your current balance is: 0").waitFor();
});
