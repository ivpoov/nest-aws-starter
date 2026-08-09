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
  # TWO SPELLINGS OF THE SAME SUBJECT, and you must know which one your
  # repository uses. GitHub has a second, IMMUTABLE default subject format that
  # interpolates numeric ids the owner and repository keep forever:
  #
  #     repo:<owner>@<owner-id>/<name>@<repo-id>:environment:<name>
  #
  # It applies to repositories created after 2026-07-15, and to any repository
  # renamed or transferred after that date. It exists to close the one real
  # weakness of the name-based form: names can be released and re-registered, so
  # a policy naming `owner/name` can in principle be satisfied by whoever holds
  # that name next, whereas ids are never reissued.
  #
  # THIS MODULE CANNOT DETECT WHICH FORM APPLIES TO YOU. Terraform has no
  # GitHub provider here, the REST reference does not document a field that
  # answers it, and the fields that do exist have been observed disagreeing with
  # each other on a single repository. So the subject is expressible rather than
  # assumed: var.github_subject_format picks the shape,
  # var.github_repository_ids supplies the ids the immutable shape needs, and
  # var.github_deploy_subject_override replaces the whole computed value when
  # neither shape is right (a customised claim template, say).
  #
  # Guessing wrong FAILS CLOSED — AccessDenied at the assume-role step, nothing
  # deployed, no grant widened — and deploy.yml prints the `sub` the run was
  # actually issued when that happens, so one failed run settles it. README.md
  # gives the `gh api` call that reads it without deploying anything.
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
  # So: StringEquals, literal values, the environment named in full. No wildcard
  # operator is used anywhere in the trust policy; var.github_repository,
  # var.github_deploy_environment and var.github_deploy_subject_override all
  # reject `*` and `?` outright, and var.github_repository_ids is typed as
  # numbers, which cannot contain either. A StringLike therefore cannot be
  # reintroduced by editing a variable. The environment name additionally
  # rejects `:`, the separator the claim itself is built from — without that, an
  # environment called `production:ref:refs/heads/main` would make the subject
  # ambiguous with a customised claim template.
  #
  # `values` may hold TWO entries when var.github_subject_format is "both".
  # StringEquals over a list is an OR of exact matches, not a pattern, so the
  # no-wildcard property survives — but it does widen the policy, and the
  # trade-off is argued in README.md. "both" is not the default.
  # ---------------------------------------------------------------------

  github_repository_owner = split("/", var.github_repository)[0]
  github_repository_name  = split("/", var.github_repository)[1]

  # The historical shape. Still what every repository created before 2026-07-15
  # and never renamed since is issued.
  github_subject_mutable = "repo:${var.github_repository}:environment:${var.github_deploy_environment}"

  # The immutable shape. Null unless the ids were supplied; the variable
  # validation makes supplying them mandatory whenever this shape is selected,
  # so a null can never reach the policy.
  github_subject_immutable = var.github_repository_ids == null ? null : format(
    "repo:%s@%d/%s@%d:environment:%s",
    local.github_repository_owner,
    var.github_repository_ids.owner,
    local.github_repository_name,
    var.github_repository_ids.repository,
    var.github_deploy_environment,
  )

  github_deploy_subjects = (
    var.github_deploy_subject_override != null
    ? [var.github_deploy_subject_override]
    : var.github_subject_format == "mutable" ? [local.github_subject_mutable]
    : var.github_subject_format == "immutable" ? [local.github_subject_immutable]
    : [local.github_subject_mutable, local.github_subject_immutable]
  )

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

    # StringEquals, literal values, the environment named in full. See the note
    # on local.github_deploy_subjects.
    condition {
      test     = "StringEquals"
      variable = "${local.github_oidc_issuer}:sub"
      values   = local.github_deploy_subjects
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
