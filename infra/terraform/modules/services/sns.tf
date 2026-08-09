# ---------------------------------------------------------------------------
# Application notification topic
#
# Fan-out for application events. Kept separate from the observability alerts
# topic on purpose: that one is for humans on call, this one is for machines,
# and mixing them means either paging on business events or losing alerts in
# the noise.
#
# The topic exists; the task role's sns:Publish does not. Nothing in apps/api
# publishes to it — SnsProviderService has no consumer — and iam.tf explains why
# an unused grant is removed rather than scoped. This resource is the extension
# point: add a subscription and a publisher, then paste the statement back.
#
# Not encrypted at rest. SNS SSE requires a KMS key, and every publisher then
# additionally needs kms:GenerateDataKey* and kms:Decrypt on it — a broader
# grant than anything else in this module, in exchange for encrypting messages
# that live for seconds. If your data classification requires it, set
# kms_master_key_id = "alias/aws/sns" here and add the two KMS actions to the
# task role in iam.tf.
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "notifications" {
  name = var.notifications_topic_name
}

data "aws_iam_policy_document" "notifications" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.notifications.arn]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_sns_topic_policy" "notifications" {
  arn    = aws_sns_topic.notifications.arn
  policy = data.aws_iam_policy_document.notifications.json
}
