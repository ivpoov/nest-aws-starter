# ---------------------------------------------------------------------------
# What a deployment is allowed to do — and nothing else.
#
# Every statement below exists because one line of .github/workflows/deploy.yml
# needs it, and the comment says which line. Nothing is granted by AWS managed
# policy (PowerUserAccess would have been one line and would also have let a
# compromised workflow delete the database), and the only wildcard resources are
# the three actions AWS supports no resource types for at all.
#
# Deliberately NOT granted, each because losing it costs a deployment and having
# it costs the stack:
#
#   ecr:BatchDeleteImage       a rollback target that can be deleted is not one
#   ecs:DeleteService,
#   ecs:DeregisterTaskDefinition
#                              a deploy never removes anything
#   s3:DeleteObject            see the sync step: the workflow never deletes,
#                              so a compromised run cannot empty the site
#   cloudfront:UpdateDistribution
#                              invalidation is not reconfiguration
#   logs:PutLogEvents          read the logs, do not write them
#   iam:*                      beyond the one scoped PassRole below
#   rds:*, secretsmanager:*, ssm:PutParameter
#                              a deploy has no business near the data tier
# ---------------------------------------------------------------------------

locals {
  ecs_cluster_arn = format(
    "arn:%s:ecs:%s:%s:cluster/%s",
    data.aws_partition.current.partition,
    data.aws_region.current.region,
    data.aws_caller_identity.current.account_id,
    var.ecs_cluster_name,
  )

  ecs_service_arn = format(
    "arn:%s:ecs:%s:%s:service/%s/%s",
    data.aws_partition.current.partition,
    data.aws_region.current.region,
    data.aws_caller_identity.current.account_id,
    var.ecs_cluster_name,
    var.ecs_service_name,
  )

  # Task definition ARNs carry a revision, and `run-task --task-definition
  # <family>` resolves the newest one — so the resource has to be the family
  # with a revision wildcard. It is still one family: the API's own family is
  # not in this list, so this role cannot start an application task out of band.
  migration_task_definition_arn = format(
    "arn:%s:ecs:%s:%s:task-definition/%s:*",
    data.aws_partition.current.partition,
    data.aws_region.current.region,
    data.aws_caller_identity.current.account_id,
    var.migration_task_definition_family,
  )

  # A task ARN is only known after RunTask returns, so DescribeTasks is scoped
  # by cluster instead — the `ecs:cluster` condition below narrows it further.
  ecs_task_arn_pattern = format(
    "arn:%s:ecs:%s:%s:task/%s/*",
    data.aws_partition.current.partition,
    data.aws_region.current.region,
    data.aws_caller_identity.current.account_id,
    var.ecs_cluster_name,
  )

  # Two forms per group: CloudWatch Logs expects the bare group ARN for the
  # Describe* calls and the ":*" suffixed form for the stream-level reads.
  log_group_arns = flatten([
    for name in var.log_group_names : [
      format(
        "arn:%s:logs:%s:%s:log-group:%s",
        data.aws_partition.current.partition,
        data.aws_region.current.region,
        data.aws_caller_identity.current.account_id,
        name,
      ),
      format(
        "arn:%s:logs:%s:%s:log-group:%s:*",
        data.aws_partition.current.partition,
        data.aws_region.current.region,
        data.aws_caller_identity.current.account_id,
        name,
      ),
    ]
  ])

  site_bucket_arns        = [for name in var.site_bucket_names : "arn:${data.aws_partition.current.partition}:s3:::${name}"]
  site_bucket_object_arns = [for arn in local.site_bucket_arns : "${arn}/*"]

  # CloudFront is global: its ARNs carry an account but no region.
  cloudfront_distribution_arns = [
    for id in var.cloudfront_distribution_ids :
    format(
      "arn:%s:cloudfront::%s:distribution/%s",
      data.aws_partition.current.partition,
      data.aws_caller_identity.current.account_id,
      id,
    )
  ]

  manifest_parameter_arn = format(
    "arn:%s:ssm:%s:%s:parameter%s",
    data.aws_partition.current.partition,
    data.aws_region.current.region,
    data.aws_caller_identity.current.account_id,
    var.names.manifest_parameter,
  )
}

data "aws_iam_policy_document" "deploy" {
  # -------------------------------------------------------------------
  # Step 0 — read the deploy manifest
  # -------------------------------------------------------------------

  # One parameter, read only. This is the workflow's first call and the only
  # thing it needs to know before it knows anything else about the stack.
  statement {
    sid       = "ReadDeployManifest"
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = [local.manifest_parameter_arn]
  }

  # -------------------------------------------------------------------
  # Step 1 — build and push the images
  # -------------------------------------------------------------------

  # Unavoidable "*", same as the execution role in modules/services:
  # ecr:GetAuthorizationToken returns a token for the account's registry as a
  # whole and AWS supports no resource types for it. It yields a docker login
  # credential; what that credential can then do is scoped by the next statement.
  statement {
    sid       = "EcrAuthorizationToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # `docker push` is four calls (InitiateLayerUpload, UploadLayerPart,
  # CompleteLayerUpload, PutImage) plus BatchCheckLayerAvailability to skip
  # layers already there. The two read actions let the build pull its own
  # previous image as a cache source.
  statement {
    sid    = "EcrPushStackImages"
    effect = "Allow"

    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:DescribeImages",
    ]

    resources = var.ecr_repository_arns
  }

  # -------------------------------------------------------------------
  # Step 2 and 3 — run the migration task and gate on its exit code
  # -------------------------------------------------------------------

  # RunTask on the migration family only, and only into this cluster. Both
  # halves matter: without the resource scope the role could start any task
  # definition in the account, and without the condition it could start the
  # migration task in someone else's cluster.
  statement {
    sid       = "EcsRunMigrationTask"
    effect    = "Allow"
    actions   = ["ecs:RunTask"]
    resources = [local.migration_task_definition_arn]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [local.ecs_cluster_arn]
    }
  }

  # `aws ecs wait tasks-stopped` and the exit-code query are both DescribeTasks.
  statement {
    sid       = "EcsDescribeTasks"
    effect    = "Allow"
    actions   = ["ecs:DescribeTasks"]
    resources = [local.ecs_task_arn_pattern]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [local.ecs_cluster_arn]
    }
  }

  # Read the migration output when the gate fails, and the API's log group when
  # the service will not stabilise. Read only — a workflow that could
  # PutLogEvents could also forge the evidence of what it did.
  statement {
    sid    = "ReadDeploymentLogs"
    effect = "Allow"

    actions = [
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:FilterLogEvents",
      "logs:GetLogEvents",
      "logs:StartLiveTail",
    ]

    resources = local.log_group_arns
  }

  # -------------------------------------------------------------------
  # Step 4 — register the new revision and update the service
  # -------------------------------------------------------------------

  # The second unavoidable "*". ecs:RegisterTaskDefinition and
  # ecs:DescribeTaskDefinition support no resource types — a task definition
  # family does not exist until something registers into it, so there is nothing
  # to scope against. The blast radius is bounded from the other side instead:
  # a task definition is inert until something runs it, and the only ways this
  # role can run one are UpdateService on a single service and RunTask on a
  # single family, both above. Registering a task definition that references any
  # role also requires PassRole, which is the next statement and is scoped to
  # exactly two.
  statement {
    sid    = "EcsRegisterTaskDefinitionRevision"
    effect = "Allow"

    actions = [
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
    ]

    resources = ["*"]
  }

  # PassRole is the permission that turns "can register a task definition" into
  # "can run code as any role in the account", so it is scoped to the two roles
  # the compute stack already uses and conditioned on the service that may
  # receive them. Without the condition, holding PassRole on these two roles
  # would let them be handed to any AWS service that accepts a role.
  statement {
    sid       = "PassEcsTaskRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = var.task_role_arns

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  # UpdateService points the service at the new revision; DescribeServices is
  # both the `wait services-stable` waiter and the check afterwards that the
  # deployment circuit breaker did not quietly roll it back.
  statement {
    sid    = "EcsUpdateApiService"
    effect = "Allow"

    actions = [
      "ecs:DescribeServices",
      "ecs:UpdateService",
    ]

    resources = [local.ecs_service_arn]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [local.ecs_cluster_arn]
    }
  }

  # -------------------------------------------------------------------
  # Step 6 — publish the frontends
  # -------------------------------------------------------------------

  # `aws s3 sync` lists the destination before it copies; without ListBucket it
  # re-uploads everything on every deploy and cannot tell what is already there.
  statement {
    sid       = "ListSiteBuckets"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = local.site_bucket_arns
  }

  # Write and read back, never delete. The workflow's sync runs without
  # --delete on purpose (see deploy.yml), so DeleteObject would be a permission
  # nothing uses — and one that turns a compromised deploy into an outage.
  statement {
    sid    = "PublishSiteObjects"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject",
    ]

    resources = local.site_bucket_object_arns
  }

  # CreateInvalidation for the one path the deploy invalidates, GetInvalidation
  # to wait for it. Not UpdateDistribution: the distribution's shape is
  # Terraform's, not a deployment's.
  statement {
    sid    = "InvalidateSiteDistributions"
    effect = "Allow"

    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
    ]

    resources = local.cloudfront_distribution_arns
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.names.oidc_role}-deploy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.deploy.json
}
