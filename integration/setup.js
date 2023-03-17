const { chromium } = require("playwright");
//const { config } = require("./config");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  //const user = config.users.sender;
  //const domain = config.slackBaseUrl.replace("https://", "");
  const domain = "gratibot-lab.slack.com";
  const appName = "playwright-jeff-gratibot";

  // Navigate to Slack API page
  await page.goto("https://api.slack.com/apps");

  // Sign in
  await page.click('text="sign in to your Slack account"');
  await page.click('text="sign in manually instead"');
  await page.fill('input[name="domain"]', "gratibot-lab");
  await page.click('button:has-text("Continue")');

  await page.click('text="sign in with a password instead"');
  await page.fill('input[name="email"]', process.env.SLACK_USERNAME);
  await page.fill('input[name="password"]', process.env.SLACK_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  // Click "Create New App" button
  await page.click('text="Create New App"');

  // Fill out App Name field
  await page.fill('input[name="app_name"]', appName);

  // Click "Create App" button
  await page.click('button:has-text("Create App")');

  // Wait for the app to be created and redirected to its dashboard
  await page.waitForNavigation();

  // Click "Install App" button
  await page.click('button:has-text("Install App")');

  // Fill out installation form
  await page.fill('input[name="domain"]', domain);
  //await page.fill('input[name="username"]', user.username);
  //await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="username"]', process.env.SLACK_USERNAME);
  await page.fill('input[name="password"]', process.env.SLACK_PASSWORD);
  await page.click('button:has-text("Authorize")');

  // Wait for installation to complete
  await page.waitForSelector(
    'div:has-text("Your app has been successfully installed!")'
  );

  // Close the browser
  await browser.close();
})();
