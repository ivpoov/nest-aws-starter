# cicd

The identity `.github/workflows/deploy.yml` runs as, and the manifest it reads.

Three things, and no more:

| Resource                       | Why                                                             |
| ------------------------------ | --------------------------------------------------------------- |
| IAM OIDC provider for GitHub   | Lets STS verify a token GitHub minted for one workflow run       |
| IAM role + inline policy       | ECR push, one ECS service update, one migration task, S3 + CloudFront for the frontends |
| One SSM `String` parameter     | Every name, id and URL the workflow needs, written by Terraform  |

It creates no compute, no buckets and no repositories. Every ARN in the policy
belongs to another module.

## No long-lived credentials, ever

There is no IAM user in this repository and no `aws_iam_access_key` resource
anywhere. `AWS_ACCESS_KEY_ID` must never become a repository secret:

- it does not expire, so a leak is permanent until someone notices;
- it works from any address on the internet, so possession is sufficient;
- it is copied into every backup of the repository settings and visible to
  every workflow, including ones added later by someone else.

Instead, each run receives a JSON Web Token from GitHub describing that run, and
STS exchanges it for a session that dies with the job.

## The trust policy is the whole security boundary

`token.actions.githubusercontent.com` issues tokens for **every repository on
github.com**. The issuer proves nothing about who is calling. Only the `sub`
claim does, and this module matches it like this:

```
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:<owner>/<name>:ref:refs/heads/main"
  }
}
```

`StringEquals`. One value. The full ref included. Three ways that is commonly
got wrong, in descending order of how bad:

| Written as                                    | Who can then assume the role                      |
| --------------------------------------------- | ------------------------------------------------- |
| no `sub` condition                            | any workflow in any repository on github.com      |
| `StringLike` `repo:owner/name:*`              | any ref in the repo — including `pull_request`, so anyone who can open a PR |
| `StringLike` `repo:owner/name*`               | `owner/name-anything`, by prefix match            |

Because the condition is `StringEquals`, an `*` in `github_repository` would be
a literal asterisk that matches nothing rather than a wildcard — but both
`github_repository` and `github_deploy_ref` reject `*` and `?` in validation
anyway, so a later switch to `StringLike` cannot silently inherit a value that
was written assuming exact matching.

`aud` is pinned in two places (the provider's `client_id_list` and the trust
policy) so that adding a second audience to the provider for some other tool
does not widen this role with it.

## No thumbprint

`thumbprint_list` is deliberately absent. IAM validates the provider's TLS chain
against its own trusted root CA store for well-known issuers, GitHub included.
Every guide written before mid-2023 tells you to paste a SHA-1 fingerprint;
those all broke simultaneously when GitHub rotated its chain. Omitting it is
current AWS guidance and cannot rot.

## Permissions, and the two unavoidable wildcards

`policy.tf` states the reason for every action next to it. The only `"*"`
resources are the actions AWS supports no resource types for:

- `ecr:GetAuthorizationToken` — returns a token for the registry as a whole;
  what the resulting docker login can do is scoped by the push statement.
- `ecs:RegisterTaskDefinition` / `ecs:DescribeTaskDefinition` — a family does
  not exist until something registers into it. Bounded from the other side: a
  task definition is inert, and the only ways this role can run one are
  `UpdateService` on a single service and `RunTask` on a single family. Any task
  definition that references a role also needs `iam:PassRole`, which is scoped
  to exactly two roles and conditioned on `ecs-tasks.amazonaws.com`.

Not granted, on purpose: `ecr:BatchDeleteImage` (a rollback target that can be
deleted is not one), `s3:DeleteObject` (the sync runs without `--delete`),
`cloudfront:UpdateDistribution`, `logs:PutLogEvents`, and anything at all
against RDS, Secrets Manager or the rest of Parameter Store.

## The deploy manifest

`aws ssm get-parameter --name <manifest> --query Parameter.Value` returns one
JSON object with every cluster name, family, container name, bucket,
distribution id and base URL a deployment needs. The workflow reads it once and
derives everything else. That is what makes "no hand-copied URLs" true rather
than aspirational — change a name in Terraform and the next deploy follows.

The alternative, running `terraform output` inside CI, would mean handing the
job the backend configuration (which embeds an account id) and read access to
the state file (which holds the database password). One parameter of non-secret
metadata is a much smaller thing to hand a CI job.

The variable's `object` type **is** the contract with the workflow. A field the
workflow reads must exist there; a field removed there fails at the `jq` that
reads it rather than three steps later.

## Wiring it up

`terraform output github_actions_setup` prints the literal commands:

```bash
gh secret set AWS_DEPLOY_ROLE_ARN --body '<role arn>'
gh variable set AWS_REGION --body '<region>'
gh variable set DEPLOY_MANIFEST_PARAMETER --body '<parameter name>'
```

One secret, two variables, no access key.

## Rolling back

```bash
gh workflow run deploy.yml -f sha=<earlier-commit-sha>
```

That is the whole procedure. Images are tagged with the commit SHA, so an
earlier SHA is an unambiguous artefact; `latest` would not be.

## Second environment in the same account

An AWS account may hold exactly one IAM identity provider per issuer URL. The
second stack must set `create_github_oidc_provider = false` and adopt the
existing one, or apply fails with `EntityAlreadyExists`. Destroying the stack
that owns the provider then leaves it behind for the other one, which is the
intended behaviour.
