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
  # The `sub` claim of a GitHub Actions token is a structured string, and the
  # default subject-claim template emits exactly ONE of these shapes per run:
  #
  #     repo:<owner>/<name>:ref:refs/heads/<branch>
  #     repo:<owner>/<name>:pull_request
  #     repo:<owner>/<name>:environment:<name>
  #
  # The third shape REPLACES the first — it does not extend it. A job that
  # declares `environment: production` is issued
  # `repo:<owner>/<name>:environment:production` and no ref appears in the
  # claim at all. deploy.yml declares an environment (that is where required
  # reviewers and a wait timer attach), so the environment form is the only
  # subject this role will ever be shown, and matching the ref form here would
  # mean AccessDenied on the very first step of every deployment.
  #
  # Matching the environment is also the STRONGER of the two, because GitHub
  # evaluates the environment's protection rules — its deployment branch rule
  # above all — before it mints the token. A ref condition is checked by AWS
  # after GitHub has already handed out a credential; a branch rule is checked
  # by GitHub before one exists. See README.md: the branch rule is a manual
  # step, and it is the half of this control that Terraform cannot create.
  #
  # The claim is issued by token.actions.githubusercontent.com for EVERY
  # repository on github.com — public ones included. The issuer therefore
  # proves nothing about who is calling; only the `sub` does. Three ways to get
  # this wrong, all of them common:
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
  # So: StringEquals, one literal value, the environment named in full. No
  # wildcard operator is used anywhere in the trust policy, and
  # var.github_repository and var.github_deploy_environment both reject `*` and
  # `?` outright, so a StringLike cannot be reintroduced by editing a variable.
  # The environment name additionally rejects `:`, which is the separator the
  # claim itself is built from — without that, an environment called
  # `production:ref:refs/heads/main` would make the subject ambiguous with a
  # customised claim template.
  #
  # NOTE: if you ever customise the repository's subject-claim template
  # (`PUT /repos/{owner}/{repo}/actions/oidc/customization/sub`), this value
  # stops matching and every deployment fails closed until it is updated to the
  # new shape. That is the safe direction to fail in, but it is worth knowing
  # before you go looking for the cause.
  # ---------------------------------------------------------------------
  github_deploy_subject = "repo:${var.github_repository}:environment:${var.github_deploy_environment}"

  # The deployment branch rule is expressed to GitHub as a bare name plus a
  # type, not as a full ref, so the `refs/...` form is decomposed once here and
  # used only to build the setup commands in outputs.tf.
  github_deploy_ref_is_tag = startswith(var.github_deploy_ref, "refs/tags/")
  github_deploy_ref_type   = local.github_deploy_ref_is_tag ? "tag" : "branch"
  github_deploy_ref_name   = trimprefix(trimprefix(var.github_deploy_ref, "refs/heads/"), "refs/tags/")

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
    sid     = "GitHubActionsDeployFromProtectedEnvironmentOnly"
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

    # StringEquals, one value, the environment named in full. See the note on
    # local.github_deploy_subject.
    condition {
      test     = "StringEquals"
      variable = "${local.github_oidc_issuer}:sub"
      values   = [local.github_deploy_subject]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name        = var.names.oidc_role
  description = "Assumed by GitHub Actions from ${var.github_repository}, and only by a job running in the ${var.github_deploy_environment} environment, through OIDC. No access keys exist for this identity."

  assume_role_policy   = data.aws_iam_policy_document.assume_role.json
  max_session_duration = var.max_session_duration_seconds

  tags = {
    Name = var.names.oidc_role
    Tier = "cicd"
  }
}
