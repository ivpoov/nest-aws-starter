# Security policy

## Supported versions

Only the **latest minor release line** receives security fixes. When a new
minor is tagged, the previous one stops being supported — there are no
long-term-support branches. The current line is whatever the newest tag on
[the releases page](https://github.com/ivpoov/nest-aws-starter/releases) says.

If you are running an older line, upgrading to the latest minor is the fix.

## Reporting a vulnerability

Report privately through GitHub Security Advisories:

**[Report a vulnerability](https://github.com/ivpoov/nest-aws-starter/security/advisories/new)**

That link opens a private advisory draft visible only to you and the
maintainer. Please do **not** open a public issue, a pull request, or a
discussion for a suspected vulnerability, and do not send the report to a
personal email address — the advisory thread is the only channel that is
tracked.

A useful report includes:

- the affected version or commit,
- what an attacker gains, and
- the smallest set of steps that reproduces it.

You will get a reply in the advisory thread. Discussion, patch review and
coordination all happen there.

## Disclosure

Coordinated disclosure with a **90-day window**. Ninety days after the report
is acknowledged, the advisory is published and the details become public —
whether or not a fix has shipped. If a fix lands sooner, the advisory is
published with it. An earlier or later date can be agreed in the advisory
thread if the reporter asks and the circumstances warrant it.

Credit is given in the advisory unless you ask to stay anonymous.

## What this project is, and what it is not

This repository is a **starter template**. It is copied and modified, not
installed as a dependency, so there is no upgrade path that reaches your fork:
once you clone it, its security is yours to maintain.

That matters for two things in particular:

- **No production secrets ship here.** Every credential in this repository —
  in the `.env.example` files, `docker-compose.yml` and the test fixtures — is
  a local development placeholder pointed at LocalStack, MinIO and containers
  on your own machine. Nothing in the tree is a real key, and nothing in the
  tree is meant to reach an environment that is not your laptop.
- **Adopters own their key management.** Generating real secrets, storing them
  (AWS Secrets Manager, SSM Parameter Store, or whatever your deployment
  uses), rotating them, and keeping them out of version control is entirely
  the responsibility of whoever deploys a project built from this starter. The
  starter provides the wiring; it does not provide, hold or manage your key
  material.

Reports about a deployment built from this template, rather than about the
template itself, are outside the scope of this policy — but a report showing
that the template's own defaults lead a reasonable adopter into an insecure
deployment is very much in scope, and worth sending.
