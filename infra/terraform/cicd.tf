# ---------------------------------------------------------------------------
# CI/CD — GitHub OIDC, the deploy role, and the manifest the workflow reads.
#
# This file exists so that .github/workflows/deploy.yml needs exactly one
# secret (a role ARN) and knows exactly nothing about this stack up front. Both
# halves of that are deliberate:
#
#   no long-lived keys   There is no IAM user and no access key anywhere in this
#                        repository. AWS_ACCESS_KEY_ID must never become a
#                        repository secret: it does not expire, it works from
#                        any address on the internet, and a public repository is
#                        exactly where one gets found. GitHub mints a
#                        short-lived OIDC token per run instead, and the trust
#                        policy in modules/cicd/oidc.tf admits precisely one
#                        repository, running in one GitHub environment.
#
#   one manual step      Terraform has no GitHub provider here and cannot create
#                        that environment or the deployment branch rule on it.
#                        `terraform output github_actions_setup` prints the two
#                        `gh api` calls that do; until they are run, the
#                        environment GitHub auto-creates has no rules and any
#                        branch a dispatch starts from can reach the role.
#
#   no hand-copied URLs  Every bucket name, distribution id, cluster name and
#                        base URL a deployment needs is derived here from the
#                        modules that own them and written to one SSM parameter.
#                        The workflow reads that parameter and derives the rest.
#                        Nothing is pasted into a workflow file, a repository
#                        variable, or a wiki page where it can go stale.
# ---------------------------------------------------------------------------

variable "github_repository" {
  description = <<-EOT
    The GitHub repository allowed to deploy this stack, as "owner/name".

    Leave it null and no CI/CD resources are created at all — no OIDC provider,
    no role, no parameter. That is the right posture for a stack deployed by
    hand from a laptop; it is the wrong one for anything that deploys itself,
    because the alternative to a scoped OIDC role is an access key.
  EOT
  type        = string
  default     = null
}

variable "github_deploy_environment" {
  description = "GitHub Actions environment the deploy job runs in, and the second half of the trust policy's `sub` claim. Must equal the `environment:` value in .github/workflows/deploy.yml — GitHub replaces the ref subject with the environment subject for any job that declares one, so a mismatch means AccessDenied on every deployment."
  type        = string
  default     = "production"
}

variable "github_deploy_ref" {
  description = "Full git ref deployments may run from. Not part of the trust policy — it is the branch to set as the environment's deployment branch rule, which GitHub enforces before the token is minted. The default branch is the default because it is the only ref that has been reviewed."
  type        = string
  default     = "refs/heads/main"
}

variable "create_github_oidc_provider" {
  description = "Create the account's IAM OIDC provider for GitHub. Set to false when one already exists — an account may hold only one identity provider per issuer, so a second environment in the same account must adopt rather than create."
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# Names
#
# Both from local.names. The manifest parameter lives under the same
# /<project>/<environment> path as every other parameter this stack writes.
#
# There is no separate deploy role and no build-artifact bucket, and local.names
# no longer carries a key for either. The OIDC role IS the deploy identity, and
# there is nothing to store: images go to ECR and the frontends go straight to
# the site buckets. An empty bucket that exists "for artifacts" is a resource
# nobody can explain a year later.
# ---------------------------------------------------------------------------

locals {
  cicd_names = {
    oidc_role          = local.names.github_oidc_role
    manifest_parameter = local.names.deploy_manifest_parameter
  }

  cicd_enabled = var.github_repository != null

  # The workflow this stack issues an identity to. Read (when it is there) only
  # so the check below can compare the environment name in it against the one
  # baked into the trust policy — a mismatch between the two is invisible until
  # the first deployment fails with AccessDenied, which reads like a broken role
  # rather than a typo. `fileexists` because a copy of infra/ lifted into another
  # repository is a legitimate thing to do, and a missing workflow must not turn
  # a soft check into a hard error.
  cicd_deploy_workflow_path = "${path.module}/../../.github/workflows/deploy.yml"
}

# ---------------------------------------------------------------------------
# The frontends' build-time environment
#
# edge.tf already computes this as the frontend_build_env output, but an output
# is not addressable from inside the same stack, so it is rebuilt here from the
# same module outputs rather than restated by hand.
#
# The one addition is the fallback edge.tf documents and cannot make itself:
# module.edge.api_url is null while the optional CloudFront distribution in
# front of the ALB is disabled, and in that case the frontends must talk to the
# load balancer directly — a URL only the compute module knows.
# ---------------------------------------------------------------------------

locals {
  # Prefer the edge origin when it exists: it is HTTPS, it is cached, and it is
  # the hostname the certificate covers. Fall back to the load balancer.
  cicd_api_origin = coalesce(module.edge.api_url, module.compute.api_url)

  # The application mounts every route under API_PREFIX with URI versioning on
  # top, which is where the /api/v1 comes from. Read from the environment the
  # API is actually given rather than restated, so overriding API_PREFIX through
  # var.api_extra_environment cannot leave the frontends pointing at a prefix
  # the API does not serve.
  cicd_api_path_prefix = "/${local.compute_api_environment.API_PREFIX}/v1"

  cicd_frontend_env = {
    VITE_API_BASE_URL = "${local.cicd_api_origin}${local.cicd_api_path_prefix}"
    VITE_WEB_APP_URL  = module.edge.site_urls["web"]
  }

  # The smoke test hits the LOAD BALANCER, not the edge origin above, and that
  # is not an oversight. A deployment has just replaced the tasks behind the
  # load balancer; testing through CloudFront would put a cache and a second set
  # of failure modes between the check and the thing being checked. Must stay in
  # step with the health_check_path passed to the compute module in compute.tf.
  cicd_health_check_url = "${module.compute.api_url}${local.cicd_api_path_prefix}/health/ready"
}

# ---------------------------------------------------------------------------
# Module
# ---------------------------------------------------------------------------

module "cicd" {
  source = "./modules/cicd"

  count = local.cicd_enabled ? 1 : 0

  names = local.cicd_names

  github_repository         = var.github_repository
  github_deploy_environment = var.github_deploy_environment
  github_deploy_ref         = var.github_deploy_ref
  create_oidc_provider      = var.create_github_oidc_provider

  # Everything below is an existing resource owned by another module. The cicd
  # module creates none of them; it only writes a policy that names them.
  ecr_repository_arns              = values(module.compute.ecr_repository_arns)
  ecs_cluster_name                 = module.compute.cluster_name
  ecs_service_name                 = module.compute.service_name
  migration_task_definition_family = module.compute.migration_task_definition_family
  task_role_arns                   = [module.services.task_role_arn, module.services.task_execution_role_arn]
  log_group_names                  = values(module.compute.log_group_names)
  site_bucket_names                = values(module.edge.site_bucket_names)
  cloudfront_distribution_ids      = values(module.edge.site_distribution_ids)

  deploy_manifest = {
    ecr_repository_url   = module.compute.ecr_repository_urls["api"]
    migrations_image_tag = var.migrations_image_tag

    ecs_cluster                       = module.compute.cluster_name
    ecs_service                       = module.compute.service_name
    api_task_definition_family        = module.compute.api_task_definition_family
    api_container_name                = module.compute.api_container_name
    migrations_task_definition_family = module.compute.migration_task_definition_family
    migrations_container_name         = module.compute.migration_container_name
    migrations_network_configuration  = module.compute.migration_network_configuration

    api_log_group        = module.compute.log_group_names["api"]
    migrations_log_group = module.compute.log_group_names["migrations"]

    health_check_url = local.cicd_health_check_url

    web_bucket            = module.edge.site_bucket_names["web"]
    admin_bucket          = module.edge.site_bucket_names["admin"]
    web_distribution_id   = module.edge.site_distribution_ids["web"]
    admin_distribution_id = module.edge.site_distribution_ids["admin"]
    frontend_env          = local.cicd_frontend_env

    api_cors_origins = join(",", module.edge.cors_origins)
  }
}

# ---------------------------------------------------------------------------
# Preflight warnings (soft — hard errors belong in variable validation)
# ---------------------------------------------------------------------------

check "deployments_have_an_identity" {
  assert {
    condition = local.cicd_enabled
    error_message = join(" ", [
      "github_repository is unset, so no OIDC provider, deploy role or deploy manifest is created and .github/workflows/deploy.yml cannot assume anything.",
      "Deploying anyway means putting an IAM user's access key in AWS_ACCESS_KEY_ID, which is a permanent credential in a public repository's settings — set github_repository instead.",
    ])
  }
}

check "deployments_run_from_a_branch" {
  assert {
    # A tag ref is legitimate (release-tag deploys are a real pattern), but it
    # is worth saying out loud: tags are movable by anyone with push access and
    # carry no review history, so a tag-triggered deploy trusts whoever can
    # write a tag rather than whoever can merge a pull request.
    condition = !local.cicd_enabled || startswith(var.github_deploy_ref, "refs/heads/")
    error_message = join(" ", [
      "github_deploy_ref is a tag, not a branch. Tags can be moved and deleted by anyone with push access and are not protected by branch protection or required reviews.",
      "If that is intended, protect the tag pattern in the repository's rulesets; otherwise point this at refs/heads/<default-branch>.",
    ])
  }
}

check "deploy_workflow_declares_the_trusted_environment" {
  assert {
    condition = (
      !local.cicd_enabled
      || !fileexists(local.cicd_deploy_workflow_path)
      || strcontains(file(local.cicd_deploy_workflow_path), "environment: ${var.github_deploy_environment}")
    )
    error_message = join(" ", [
      ".github/workflows/deploy.yml does not declare `environment: ${var.github_deploy_environment}`, but the deploy role's trust policy admits only repo:${coalesce(var.github_repository, "<unset>")}:environment:${var.github_deploy_environment}.",
      "GitHub substitutes the environment for the ref in the OIDC `sub` claim, so the two names must agree exactly or every deployment fails at the assume-role step with AccessDenied.",
      "Set github_deploy_environment to the name the workflow uses, or change the workflow to match.",
    ])
  }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "github_actions_role_arn" {
  description = "Role GitHub Actions assumes through OIDC. The value of the AWS_DEPLOY_ROLE_ARN repository secret, and the only AWS credential this project has."
  value       = one(module.cicd[*].role_arn)
}

output "github_actions_trusted_subject" {
  description = "The exact OIDC `sub` claim the deploy role admits, matched with StringEquals. Any other repository, or any job not running in the deploy environment, is refused by STS."
  value       = one(module.cicd[*].trusted_subject)
}

output "github_actions_deploy_environment" {
  description = "GitHub Actions environment named in the trust policy. Terraform cannot create it — see github_actions_setup for the `gh api` calls that create it and pin its deployment branch rule."
  value       = one(module.cicd[*].deploy_environment)
}

output "github_oidc_provider_arn" {
  description = "IAM OIDC provider for GitHub — created by this stack, or the pre-existing one it adopted when create_github_oidc_provider is false."
  value       = one(module.cicd[*].oidc_provider_arn)
}

output "deploy_manifest_parameter_name" {
  description = "SSM parameter holding every name, id and URL the deploy workflow needs. The value of the DEPLOY_MANIFEST_PARAMETER repository variable."
  value       = one(module.cicd[*].deploy_manifest_parameter_name)
}

output "deploy_manifest" {
  description = "The manifest itself. Useful for diffing what CI will read against what the stack actually is, without a round trip to SSM."
  value       = one(module.cicd[*].deploy_manifest)
}

output "github_actions_setup" {
  description = "Literal `gh` commands that configure the repository for deployment. Run them from a clone — nothing in them needs retyping, which is what keeps a stale URL out of CI."
  value       = one(module.cicd[*].github_actions_setup)
}
