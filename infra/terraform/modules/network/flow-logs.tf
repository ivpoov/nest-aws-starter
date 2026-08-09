# ---------------------------------------------------------------------------
# VPC flow logs — off in the demo profile
#
# Flow logs are the only record of "what actually talked to what" once an
# incident is underway; without them a security-group question is unanswerable
# after the fact. They are also billed on ingestion and storage, and a demo
# stack that gets torn down has nothing worth investigating, so the profile
# decides. Only rejected and accepted traffic metadata is captured — no packet
# contents, so nothing sensitive lands in the log group.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "flow_logs" {
  count = var.flow_logs_enabled ? 1 : 0

  name              = var.names.flow_log_group
  retention_in_days = var.flow_log_retention_days
}

data "aws_iam_policy_document" "flow_logs_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "flow_logs" {
  count = var.flow_logs_enabled ? 1 : 0

  statement {
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]

    # Scoped to this VPC's log group and its streams — not the "*" that the AWS
    # documentation example uses, which grants write access to every log group
    # in the account.
    resources = [
      "${aws_cloudwatch_log_group.flow_logs[count.index].arn}:*",
    ]
  }
}

resource "aws_iam_role" "flow_logs" {
  count = var.flow_logs_enabled ? 1 : 0

  name               = var.flow_log_role_name
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume_role.json
}

resource "aws_iam_role_policy" "flow_logs" {
  count = var.flow_logs_enabled ? 1 : 0

  name   = var.flow_log_role_name
  role   = aws_iam_role.flow_logs[count.index].id
  policy = data.aws_iam_policy_document.flow_logs[count.index].json
}

resource "aws_flow_log" "this" {
  count = var.flow_logs_enabled ? 1 : 0

  vpc_id                   = aws_vpc.this.id
  traffic_type             = "ALL"
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.flow_logs[count.index].arn
  iam_role_arn             = aws_iam_role.flow_logs[count.index].arn
  max_aggregation_interval = 600 # 10 minutes: fewer, larger records, less ingestion billed

  tags = {
    Name = var.names.flow_log_group
  }
}
