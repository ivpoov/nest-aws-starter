# ---------------------------------------------------------------------------
# Alert topic
#
# A second topic, deliberately. The services module already owns an SNS topic
# (local.names.notifications_topic) and it is a *data plane*: it exists for
# application domain events and its subscribers would be application consumers.
# Alarms are a control plane. Sharing one topic between them means:
#
#   - every application event fans out to the on-call address, and every alarm
#     fans out to the application's consumers;
#   - the task role would need publish on it, so anything holding that role
#     could emit a message indistinguishable from a CloudWatch alarm;
#   - reworking the application's eventing quietly takes alerting with it.
#
# The topic is created unconditionally even though the alarms are profile-gated.
# It costs nothing standing, and the budget notification and the demo operator's
# first `aws sns subscribe` both need somewhere to point.
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = var.names.alerts_topic

  tags = {
    Name = var.names.alerts_topic
    Tier = "observability"
  }
}

# Email, not email-json: the raw form is readable in a phone notification, which
# is where an alarm at 03:00 is actually read.
#
# AWS sends a confirmation mail the moment this is created and the subscription
# stays PendingConfirmation until the link is clicked. Terraform reports the
# subscription as created either way, so a green apply is not evidence that
# alerts are being delivered — confirm the mail.
resource "aws_sns_topic_subscription" "alert_email" {
  count = var.alert_email == null ? 0 : 1

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch has to be allowed to publish; the default topic policy only admits
# the owning account's principals. Scoped by SourceAccount so another account's
# alarm cannot publish into this topic.
resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.alerts_topic.json
}

data "aws_iam_policy_document" "alerts_topic" {
  # Setting a policy replaces the default one wholesale, so the statement AWS
  # would have written has to be written back. Without it the topic's own
  # account loses the resource-policy path to Subscribe and SetTopicAttributes,
  # which is the sort of thing that is only noticed from a console session.
  statement {
    sid    = "AllowOwningAccount"
    effect = "Allow"
    actions = [
      "sns:GetTopicAttributes",
      "sns:SetTopicAttributes",
      "sns:AddPermission",
      "sns:RemovePermission",
      "sns:DeleteTopic",
      "sns:Subscribe",
      "sns:ListSubscriptionsByTopic",
      "sns:Publish",
    ]
    resources = [aws_sns_topic.alerts.arn]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceOwner"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }

  statement {
    sid       = "AllowCloudWatchAlarmsToPublish"
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]

    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}
