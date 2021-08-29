# Deployment

Gratibot is deployed in Liatrio's Azure environments using GitHub Actions and
Terraform. After a change passes CI checks and is approved by reviewers, it can
be merged into main.

Merging to main will automatically kick off a deployment to Gratibot's
non-prod environment, which corresponds to the 'gratibotdev' bot inside of
Liatrio's Slack workspace.

After validating in non-prod, a new release can be initiated by pushing a
[Semantic Version](https://semver.org/) tag to GitHub. This will initiate the
production workflow which will require a code owner to review the deployment's
Terraform plan. After the workflow is approved, it will automatically deploy
to Gratibot's prod environment, which corresponds to the 'gratibot' bot inside
of Liatrio's Slack workspace.
