# ---------------------------------------------------------------------------
# SES sending identity
#
# READ THIS BEFORE YOU WONDER WHY NO MAIL ARRIVES
#
# Every new AWS account starts with SES in the *sandbox*. In the sandbox you can
# only send to addresses and domains you have separately verified, the daily cap
# is 200 messages, and the send rate is 1/second. Terraform cannot change this:
# verifying a domain here proves you own the domain, it does not take the
# account out of the sandbox.
#
# Getting out of it is a request you file by hand — AWS console, Amazon SES,
# "Account dashboard", "Request production access" — and AWS reviews it, usually
# within a day. Until they approve it, signup emails to real users are silently
# rejected, and the only clue is a MessageRejected error in the logs.
#
# This surprises everyone exactly once. It is repeated in the module outputs so
# it also shows up in `terraform output`, not just in a file nobody opens twice.
#
# The DKIM CNAME records are output rather than created: the hosted zone is not
# necessarily in this stack (the domain may live at another registrar), and
# creating records in a zone this module does not own is worse than handing you
# three values to paste.
# ---------------------------------------------------------------------------

resource "aws_ses_domain_identity" "mail" {
  count = var.mail_domain == null ? 0 : 1

  domain = var.mail_domain
}

resource "aws_ses_domain_dkim" "mail" {
  count = var.mail_domain == null ? 0 : 1

  domain = aws_ses_domain_identity.mail[0].domain
}
