# ---------------------------------------------------------------------------
# GitHub Actions -> AWS, without a single long-lived credential.
#
# The alternative this replaces is an IAM user with an access key pasted into
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY repository secrets. That key is
# valid forever, works from anywhere on the internet, and is copied into every
# fork, every log line that echoes the environment, and every backup of the
# repository settings. Nothing in this repository creates one, and nothing
# should: see the notes in README.md.
#
# What replaces it: on every run GitHub mints a short-lived OIDC token that
# describes the run — which repository, which ref, which workflow, which
# actor — and STS exchanges it for a session on the role below, but only if the
# token's claims match the trust policy exactly.
# ---------------------------------------------------------------------------

locals {
  github_oidc_issuer = "token.actions.githubusercontent.com"
  github_oidc_url    = "https://token.actions.githubusercontent.com"

  # ---------------------------------------------------------------------
  # THE condition. Everything else in this module is ordinary least
  # privilege; this one line is what stands between the role and the whole
  # of GitHub.
  #
  # The `sub` claim of a GitHub Actions token is a structured string:
  #
  #     repo:<owner>/<name>:ref:refs/heads/<branch>
  #     repo:<owner>/<name>:pull_request
  #     repo:<owner>/<name>:environment:<name>
  #
  # It is issued by token.actions.githubusercontent.com for EVERY repository
  # on github.com — public ones included. The issuer therefore proves nothing
  # about who is calling; only the `sub` does. Three ways to get this wrong,
  # all of them common:
  #
  #   no sub condition at all   Any workflow in any repository on github.com
  #                             can assume the role. This is the classic
  #                             misconfiguration and it is total.
  #   StringLike "repo:owner/name:*"
  #                             Any ref in the repository, which includes
  #                             `pull_request` — so anyone who can open a pull
  #                             request against a public repository runs with
  #                             these permissions.
  #   StringLike "repo:owner/name*"
  #                             Prefix matching: `owner/name-fork`,
  #                             `owner/name-anything`, and on some hosts an
  #                             attacker-created repository whose name starts
  #                             with yours.
  #
  # So: StringEquals, one literal value, the full ref included. No wildcard
  # operator is used anywhere in the trust policy, and var.github_repository
  # and var.github_deploy_ref both reject `*` and `?` outright, so a StringLike
  # cannot be reintroduced by editing a variable.
  # ---------------------------------------------------------------------
  github_deploy_subject = "repo:${var.github_repository}:ref:${var.github_deploy_ref}"

  oidc_provider_arn = var.create_oidc_provider ? one(aws_iam_openid_connect_provider.github[*].arn) : one(data.aws_iam_openid_connect_provider.github[*].arn)
}

# ---------------------------------------------------------------------------
# The identity provider
#
# NO THUMBPRINT. Since 2023 IAM validates an OIDC provider's TLS chain against
# its own trusted root CA store for the well-known hosts, GitHub's included, and
# ignores the thumbprint list for them. Every guide older than that tells you to
# paste a SHA-1 fingerprint here; when GitHub rotated its certificate chain, all
# of those broke at once, at 3am, with an unhelpful error. Omitting it is both
# the current AWS guidance and the thing that cannot rot.
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url = local.github_oidc_url

  # The audience the role's trust policy also pins. STS rejects a token whose
  # `aud` is not in this list before the trust policy is even evaluated.
  client_id_list = [var.oidc_audience]

  tags = {
    Name = local.github_oidc_issuer
    Tier = "cicd"
  }
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1

  url = local.github_oidc_url
}

# ---------------------------------------------------------------------------
# Trust policy
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "assume_role" {
  statement {
    sid     = "GitHubActionsDeployFromDefaultBranchOnly"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    # Redundant with client_id_list above, on purpose. If someone later adds a
    # second audience to the provider — for a different tool, in a different
    # repository — this role does not silently widen with it.
    condition {
      test     = "StringEquals"
      variable = "${local.github_oidc_issuer}:aud"
      values   = [var.oidc_audience]
    }

    # StringEquals, one value, full ref. See the note on local.github_deploy_subject.
    condition {
      test     = "StringEquals"
      variable = "${local.github_oidc_issuer}:sub"
      values   = [local.github_deploy_subject]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name        = var.names.oidc_role
  description = "Assumed by GitHub Actions from ${var.github_repository} on ${var.github_deploy_ref} only, through OIDC. No access keys exist for this identity."

  assume_role_policy   = data.aws_iam_policy_document.assume_role.json
  max_session_duration = var.max_session_duration_seconds

  tags = {
    Name = var.names.oidc_role
    Tier = "cicd"
  }
}
