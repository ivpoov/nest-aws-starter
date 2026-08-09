# Every input here is resolved by the caller from local.profile and local.names.
# This module deliberately knows nothing about cost profiles: it takes names and
# ARNs, and it never compares var.cost_profile (which it cannot even see).

variable "names" {
  description = "Resource names, taken from local.names in the root stack. Nothing in this module is hand-named."
  type = object({
    oidc_role          = string
    manifest_parameter = string
  })
}

# ---------------------------------------------------------------------------
# GitHub identity — the two variables that decide who may assume the role
# ---------------------------------------------------------------------------

variable "github_repository" {
  description = <<-EOT
    The one repository allowed to assume the deploy role, as "owner/name".

    This is half of the trust policy's `sub` condition and it is matched with
    StringEquals, so it must be the exact repository — no wildcards, no
    abbreviations. Getting a wildcard in here is the well-known way to hand
    every GitHub repository on the internet a role in your account.
  EOT
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9._-]+$", var.github_repository))
    error_message = "github_repository must be exactly \"owner/name\" — one slash, no scheme, no trailing .git."
  }

  validation {
    # Belt and braces on top of the regex above, because this is the condition
    # that a typo turns into an account-wide compromise. IAM policy conditions
    # treat "*" and "?" as wildcards in StringLike; the role below uses
    # StringEquals, where they are literals and would simply never match — but a
    # future edit to StringLike must not inherit a value that was written
    # assuming exact matching.
    condition     = !can(regex("[*?]", var.github_repository))
    error_message = "github_repository must not contain a wildcard. A wildcard in the trust policy's sub claim lets repositories you do not own assume this role."
  }
}

variable "github_deploy_ref" {
  description = <<-EOT
    The single git ref deployments may run from, in full `refs/...` form.

    The default is the default branch, which is the only ref that has passed
    review. Widening this to `refs/heads/*` or to a `pull_request` subject means
    any contributor who can open a pull request can run this role's permissions.
  EOT
  type        = string
  default     = "refs/heads/main"

  validation {
    condition     = startswith(var.github_deploy_ref, "refs/heads/") || startswith(var.github_deploy_ref, "refs/tags/")
    error_message = "github_deploy_ref must be a full ref: refs/heads/<branch> or refs/tags/<tag>."
  }

  validation {
    condition     = !can(regex("[*?]", var.github_deploy_ref))
    error_message = "github_deploy_ref must not contain a wildcard — the trust policy matches it exactly, and a wildcard here would admit every branch and every fork's pull-request ref."
  }
}

variable "oidc_audience" {
  description = "Audience (`aud`) claim GitHub is asked to mint the token for. `sts.amazonaws.com` is what aws-actions/configure-aws-credentials requests; changing it means changing the action's `audience` input too."
  type        = string
  default     = "sts.amazonaws.com"
}

variable "create_oidc_provider" {
  description = <<-EOT
    Create the IAM OIDC provider for GitHub, or reuse the one already in the
    account.

    An AWS account may hold exactly one IAM identity provider per issuer URL, so
    a second stack (or a second environment of this one) in the same account must
    set this to false and adopt the existing provider — otherwise apply fails
    with EntityAlreadyExists.
  EOT
  type        = bool
  default     = true
}

variable "max_session_duration_seconds" {
  description = "How long an assumed session lasts. One hour is the AWS minimum and comfortably longer than a deployment; a longer session only widens the window in which a leaked credential is usable."
  type        = number
  default     = 3600

  validation {
    condition     = var.max_session_duration_seconds >= 3600 && var.max_session_duration_seconds <= 43200
    error_message = "max_session_duration_seconds must be between 3600 and 43200 — the range IAM accepts."
  }
}
