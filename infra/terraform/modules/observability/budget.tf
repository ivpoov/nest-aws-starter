# ---------------------------------------------------------------------------
# Monthly cost budget
#
# The only thing in this module that is created on every profile, unconditionally
# and with no knob to turn it off. Every other safeguard here answers "is the
# application healthy?"; this one answers "is this stack still running, three
# weeks after the afternoon you spent trying it out?" — which is the failure
# mode a public starter that provisions a VPC, an RDS instance and a load
# balancer actually causes.
#
# ACCOUNT-WIDE, WITH NO COST FILTER. Filtering to this stack's tags would be
# more precise and is a trap: cost allocation tags have to be activated by hand
# in the Billing console, they only apply to usage recorded *after* activation,
# and a budget filtered on an inactive tag key reports $0.00 forever while
# looking perfectly configured. An account-wide budget over-reports on a shared
# account, which is the harmless direction to be wrong in.
#
# AWS Budgets itself is free for the first two budgets per account.
# ---------------------------------------------------------------------------

locals {
  # ACTUAL at each configured percentage, plus one FORECASTED at 100%. The
  # forecast is the one that arrives in time to act on: an actual-100% alert says
  # the money is already spent, while the forecast fires days earlier, which on a
  # forgotten stack is the difference between a $20 surprise and a $60 one.
  budget_notifications = concat(
    [
      for percent in var.budget_actual_thresholds_percent : {
        key               = "actual-${percent}"
        notification_type = "ACTUAL"
        threshold         = percent
      }
    ],
    [{
      key               = "forecasted-100"
      notification_type = "FORECASTED"
      threshold         = 100
    }],
  )
}

resource "aws_budgets_budget" "monthly" {
  name         = var.names.budget
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = format("%.2f", var.monthly_budget_amount_usd)
  limit_unit   = "USD"

  # Notifications go straight to the address rather than through the alert topic.
  # Budgets can publish to SNS, but only to a topic whose access policy admits
  # budgets.amazonaws.com, and the delivery path has region constraints that are
  # easy to get subtly wrong; a direct email subscriber has neither, and unlike
  # an SNS email subscription it needs no confirmation click to start working.
  #
  # With alert_email unset the budget still exists — it shows the spend in the
  # Budgets console and a subscriber can be added to it in one command — but it
  # notifies nobody. The root stack raises a `check` for exactly that case.
  dynamic "notification" {
    for_each = var.alert_email == null ? {} : { for n in local.budget_notifications : n.key => n }

    content {
      notification_type          = notification.value.notification_type
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
      subscriber_email_addresses = [var.alert_email]
    }
  }
}
