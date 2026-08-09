output "oidc_provider_arn" {
  description = "IAM OIDC provider for token.actions.githubusercontent.com — the one this module created, or the pre-existing one it adopted."
  value       = local.oidc_provider_arn
}

output "oidc_provider_created" {
  description = "True when this stack owns the OIDC provider. False means it adopted one that was already in the account, and destroying this stack will leave it behind."
  value       = var.create_oidc_provider
}

output "role_arn" {
  description = "Role GitHub Actions assumes. This is the value of the AWS_DEPLOY_ROLE_ARN repository secret — the only AWS-related secret this project has."
  value       = aws_iam_role.github_actions.arn
}

output "role_name" {
  description = "Name of the deploy role."
  value       = aws_iam_role.github_actions.name
}

output "trusted_subjects" {
  description = "The exact `sub` claim(s) the trust policy admits, matched with StringEquals. One entry unless github_subject_format is \"both\". A token carrying anything else — another repository, a ref, a pull request, another environment, or the other spelling of this repository's subject — is rejected by STS."
  value       = local.github_deploy_subjects
}

output "deploy_environment" {
  description = "GitHub Actions environment the deploy job must declare. Terraform cannot create it; see github_actions_setup for the commands that do."
  value       = var.github_deploy_environment
}

output "deploy_manifest_parameter_name" {
  description = "SSM parameter the deploy workflow reads its inputs from. This is the value of the DEPLOY_MANIFEST_PARAMETER repository variable."
  value       = aws_ssm_parameter.deploy_manifest.name
}

output "deploy_manifest" {
  description = "The manifest itself, for reading during a `terraform output` without a round trip to SSM."
  value       = var.deploy_manifest
}

output "github_actions_setup" {
  description = "Literal commands that configure the repository. Run them from a clone; nothing here needs to be retyped or adapted, which is the point. The environment and its branch rule are the half Terraform cannot create."

  value = <<-EOT
    # One secret and two variables. There is no AWS_ACCESS_KEY_ID and there
    # never should be — the role below is assumed through OIDC and the
    # credentials it yields expire with the job.

    gh secret set AWS_DEPLOY_ROLE_ARN --body '${aws_iam_role.github_actions.arn}'
    gh variable set AWS_REGION --body '${data.aws_region.current.region}'
    gh variable set DEPLOY_MANIFEST_PARAMETER --body '${aws_ssm_parameter.deploy_manifest.name}'

    # The role trusts ${length(local.github_deploy_subjects)} subject(s), matched with StringEquals:
    #
    ${join("\n    ", formatlist("#     %s", local.github_deploy_subjects))}
    #
    # A token minted for any other repository, or for a job that is not running
    # in the '${var.github_deploy_environment}' environment, gets an AccessDenied
    # from STS before it can do anything at all.

    # CONFIRM THAT IS THE SUBJECT YOU ARE ACTUALLY ISSUED. GitHub has two
    # default subject formats — the name-based one above and an immutable one
    # carrying numeric ids, which applies to repositories created after
    # 2026-07-15 and to any repository renamed or transferred after that date.
    # Terraform cannot see which one you get, and github_subject_format is a
    # default rather than a determination. Read the real claim without deploying
    # anything:

    gh api repos/${var.github_repository}/actions/oidc/customization/sub

    # If that returns a `sub_claim_prefix`, THAT prefix is the shape your tokens
    # carry — the trusted subject must be `<prefix>:environment:${var.github_deploy_environment}`.
    # The fields on that endpoint are not in the REST reference and have been
    # seen disagreeing with each other, so the only conclusive answer is a real
    # run: deploy.yml prints the `sub` it was issued whenever the assume-role
    # step fails. Then set, as appropriate:
    #
    #     github_subject_format          = "immutable"
    #     github_repository_ids          = { owner = <n>, repository = <n> }
    #     github_deploy_subject_override = "<the exact string from the run>"
    #
    # Reading the ids, if you need them:

    gh api repos/${var.github_repository} --jq '{owner: .owner.id, repository: .id}'

    # NOT OPTIONAL, and not creatable by Terraform: the environment named in
    # that subject, and the deployment branch rule on it. GitHub checks an
    # environment's rules BEFORE it mints the token, which is what makes this
    # stronger than matching a ref in the trust policy — but an environment with
    # no rules checks nothing, and GitHub will auto-create exactly that the
    # first time a job references one that does not exist. Run these:

    echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
      | gh api --method PUT --input - \
          repos/${var.github_repository}/environments/${var.github_deploy_environment}

    gh api --method POST \
      repos/${var.github_repository}/environments/${var.github_deploy_environment}/deployment-branch-policies \
      -f name='${local.github_deploy_ref_name}' -f type='${local.github_deploy_ref_type}'

    # Verify — the list must contain '${local.github_deploy_ref_name}' and nothing else:

    gh api repos/${var.github_repository}/environments/${var.github_deploy_environment}/deployment-branch-policies \
      --jq '.branch_policies[].name'

    # Optional and recommended for anything with real users: required reviewers
    # and a wait timer attach to the same environment, in
    # Settings -> Environments -> ${var.github_deploy_environment}.
  EOT
}
