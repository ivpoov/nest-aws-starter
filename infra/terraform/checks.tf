# Preflight checks — surfaced as warnings on plan and apply rather than hard
# errors. Use `check` for "this will probably not do what you want", and a
# variable `validation` block for "this is definitely wrong". Keep both keyed
# off local.profile.<key>, never off var.cost_profile directly.

check "alerting_destination" {
  assert {
    condition     = !(local.profile.alarms_enabled && var.alert_email == null)
    error_message = "The selected cost profile enables CloudWatch alarms, but alert_email is unset — alarms would publish into a topic nobody is subscribed to."
  }
}

check "custom_domain" {
  assert {
    condition     = !(local.profile.custom_domain_expected && var.domain_name == null)
    error_message = "The selected cost profile expects a custom domain, but domain_name is unset — the stack will serve on AWS-assigned hostnames with no ACM certificate."
  }
}
