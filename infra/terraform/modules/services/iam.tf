# ---------------------------------------------------------------------------
# Task roles
#
# Two roles, because ECS uses two identities for two different things and
# collapsing them hands the running container the ability to pull and push
# images and rewrite its own logs:
#
#   task role        — what the application's own AWS SDK calls run as. Every
#                      statement below was derived from a specific call site in
#                      apps/api/src; see the audit table in README.md.
#   execution role   — what the ECS agent uses *before* the container starts:
#                      pull the image, create the log stream. The application
#                      never assumes it.
#
# Nothing here is granted by wildcard action ("s3:*", "sqs:*") or by AWS managed
# policy. AmazonECSTaskExecutionRolePolicy would have covered the execution role
# in one line, and it grants ecr:BatchGetImage and logs:PutLogEvents on "*" —
# every repository and every log group in the account. The hand-written version
# below is longer and says what it means.
# ---------------------------------------------------------------------------

locals {
  ecr_repository_arns = [
    for name in var.ecr_repository_names :
    format(
      "arn:%s:ecr:%s:%s:repository/%s",
      data.aws_partition.current.partition,
      data.aws_region.current.region,
      data.aws_caller_identity.current.account_id,
      name,
    )
  ]

  log_group_arn_pattern = format(
    "arn:%s:logs:%s:%s:log-group:%s*:log-stream:*",
    data.aws_partition.current.partition,
    data.aws_region.current.region,
    data.aws_caller_identity.current.account_id,
    var.log_group_name_prefix,
  )

  ssm_parameter_arn_pattern = format(
    "arn:%s:ssm:%s:%s:parameter%s/*",
    data.aws_partition.current.partition,
    data.aws_region.current.region,
    data.aws_caller_identity.current.account_id,
    var.ssm_parameter_prefix,
  )

  # Sending needs both an identity to send from and an address to be pinned to.
  # One without the other is a misconfiguration, not a half-enabled feature.
  ses_enabled = var.mail_domain != null && var.mail_from_address != null
}

check "ses_from_address_matches_domain" {
  assert {
    condition = (
      var.mail_from_address == null ||
      var.mail_domain == null ||
      endswith(var.mail_from_address, "@${var.mail_domain}")
    )
    error_message = "mail_from_address is not on mail_domain — SES will reject every send, because the task role may only send from an address on the verified identity."
  }
}

# ---------------------------------------------------------------------------
# Trust policy
#
# Shared by both roles. The SourceAccount/SourceArn conditions are the
# confused-deputy guard: without them the trust policy says "any ECS task,
# anywhere, may assume this role", and ECS is a service that runs other people's
# containers too.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    sid     = "EcsTasksAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values = [
        format(
          "arn:%s:ecs:%s:%s:*",
          data.aws_partition.current.partition,
          data.aws_region.current.region,
          data.aws_caller_identity.current.account_id,
        )
      ]
    }
  }
}

# ---------------------------------------------------------------------------
# Task role — the application's own identity
# ---------------------------------------------------------------------------

resource "aws_iam_role" "task" {
  name               = var.task_role_name
  description        = "Identity the application's AWS SDK calls run as. Scoped to this stack's bucket, queue, topic and parameter path."
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

data "aws_iam_policy_document" "task" {
  # S3ProviderService: upload() -> PutObject, getPresignedUrl() -> GetObject,
  # getPresignedUploadUrl() -> PutObject, delete() -> DeleteObject,
  # headObject() -> GetObject (HeadObject is authorized by s3:GetObject).
  #
  # Object-level only, and only on this bucket. Multipart actions are absent on
  # purpose: the provider uses PutObjectCommand with a buffered body, which is a
  # single-part upload. Add AbortMultipartUpload/ListMultipartUploadParts if it
  # ever switches to @aws-sdk/lib-storage.
  statement {
    sid    = "UploadsBucketObjectAccess"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]

    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }

  # ListBucket looks like an over-grant until headObject() misbehaves. S3
  # answers a HEAD for a key that does not exist with 404 NotFound only if the
  # caller holds s3:ListBucket on the bucket; without it the answer is 403
  # AccessDenied, so as not to leak whether the key exists. S3ProviderService.
  # headObject() branches on `caught.name === 'NotFound'` and returns null —
  # with a 403 it throws instead, and every "does this upload exist?" check in
  # the application turns into a 500. Bucket-level, this one bucket, read only.
  statement {
    sid       = "UploadsBucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.uploads.arn]
  }

  # SqsProviderService: sendMessage / receiveMessages / deleteMessage, all
  # against the payment webhook queue. The queue URL comes from configuration,
  # so sqs:GetQueueUrl is never called and is not granted. The DLQ is not
  # readable by the application at all — draining it is an operator action.
  statement {
    sid    = "PaymentWebhookQueueAccess"
    effect = "Allow"

    actions = [
      "sqs:SendMessage",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
    ]

    resources = [aws_sqs_queue.webhook.arn]
  }

  # SnsProviderService.publish(). One topic, one action.
  statement {
    sid       = "PublishNotifications"
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.notifications.arn]
  }

  # SsmReadProjectParameters — see the note on the execution role: ECS resolves
  # container `secrets` with the *execution* role, so this statement covers the
  # other direction, an SDK read at runtime. Path-scoped either way: this
  # project, this environment, nothing else in the account's parameter store.
  statement {
    sid       = "ReadProjectParameters"
    effect    = "Allow"
    actions   = ["ssm:GetParameters"]
    resources = [local.ssm_parameter_arn_pattern]
  }

  # SesMailTransportService.send() -> SES v1 SendEmail, always with
  # Source = config.fromAddress. The condition pins the role to that one
  # address: holding this policy does not let the application send as
  # billing@, security@ or anyone else on the verified domain.
  dynamic "statement" {
    for_each = local.ses_enabled ? [1] : []

    content {
      sid       = "SendMailFromApplicationAddress"
      effect    = "Allow"
      actions   = ["ses:SendEmail"]
      resources = [aws_ses_domain_identity.mail[0].arn]

      condition {
        test     = "StringEquals"
        variable = "ses:FromAddress"
        values   = [var.mail_from_address]
      }
    }
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "${var.task_role_name}-application"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# ---------------------------------------------------------------------------
# Execution role — the ECS agent's identity, used before the container starts
# ---------------------------------------------------------------------------

resource "aws_iam_role" "task_execution" {
  name               = var.task_execution_role_name
  description        = "Identity the ECS agent uses to pull images and open log streams. The application never assumes this role."
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

data "aws_iam_policy_document" "task_execution" {
  # The one unavoidable "*" in this module. ecr:GetAuthorizationToken returns a
  # token for the account's registry as a whole and AWS supports no resource
  # types for it — "Resource": "*" is the only form the action accepts. It
  # yields a token, not image data; the pull itself is scoped below.
  statement {
    sid       = "EcrAuthorizationToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # The actual pull, scoped to this stack's repositories.
  statement {
    sid    = "EcrPullStackImages"
    effect = "Allow"

    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]

    resources = local.ecr_repository_arns
  }

  # logs:CreateLogGroup is deliberately absent. Log groups are Terraform's to
  # create, with a retention policy attached; a group created by the awslogs
  # driver has retention "never expire" and bills forever. If a task fails to
  # start with a CreateLogGroup denial, the fix is to declare the group, not to
  # widen this policy.
  statement {
    sid    = "WriteContainerLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = [local.log_group_arn_pattern]
  }

  # Beyond "image pull and log writes", and here on purpose: ECS resolves the
  # `secrets` block of a task definition with the execution role, not the task
  # role, before the container exists. Without this the compute stack's task
  # definition fails at startup with an SSM denial that points at a role nobody
  # thinks to check. Same path scope as the task role.
  statement {
    sid       = "ReadProjectParametersForSecretInjection"
    effect    = "Allow"
    actions   = ["ssm:GetParameters"]
    resources = [local.ssm_parameter_arn_pattern]
  }
}

resource "aws_iam_role_policy" "task_execution" {
  name   = "${var.task_execution_role_name}-agent"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution.json
}
