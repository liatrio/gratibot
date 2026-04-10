# Deployment

Gratibot is deployed in Liatrio's Azure environments using GitHub Actions and
Terraform. After a change passes CI checks and is approved by reviewers, it can
be merged into main.

Merging to main will automatically kick off a deployment to Gratibot's
non-prod environment, which corresponds to the 'gratibotdev' bot inside of
Liatrio's Slack workspace.

After validating in non-prod, semantic-release automatically creates a GitHub
Release (with changelog) based on the conventional commit history. That release
creation event triggers the production workflow, which requires a code owner to
review the Terraform plan. After approval, it automatically deploys to
Gratibot's prod environment, which corresponds to the 'gratibot' bot inside of
Liatrio's Slack workspace.
