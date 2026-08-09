# `services` module

Uploads bucket, payment webhook queue and dead-letter queue, application
notification topic, SES sending identity, and the two ECS task roles.

Wired from `infra/terraform/services.tf`. The module takes resolved values only:
names come from `local.names`, the disposability knob from
`local.profile.force_destroy_bucket`. Nothing below this boundary compares
`var.cost_profile`.

## Dead-letter queue: why `maxReceiveCount = 5`

`PaymentWebhookConsumerService` does its own attempt accounting. On a failed
dispatch it records the failure and returns *without* deleting the message, so
SQS redelivers once the visibility timeout lapses. On the attempt that reaches
`MAX_WEBHOOK_ATTEMPTS` it marks the row `FAILED` and deletes the message itself.

```
MAX_WEBHOOK_ATTEMPTS = 5
apps/api/src/modules/payment/constants/webhook-consumer.constants.ts
```

So on the ordinary failure path a message is received at most five times and
then leaves the queue under the application's control. `maxReceiveCount = 5` is
therefore not a second retry budget stacked on the first — it is the backstop
for the cases the application's accounting cannot see: a task killed before the
delete, a Redis lock held by a dead holder, a message whose handler throws
before `recordFailure()` runs. A sixth receive means the consumer is *stuck*,
not failing, and that message belongs in the DLQ.

Not the same number: `WEBHOOK_RETRY_MAX_ATTEMPTS = 8`. The retry job re-enqueues
a **new** message whose receive count starts at zero, so 8 is the cross-message
lifetime ceiling and is deliberately not what `maxReceiveCount` tracks.

Visibility timeout is 60s, comfortably above the consumer's 30s
`WEBHOOK_LOCK_TTL_MS`, so a message is never redelivered while its per-event
Redis lock is still held.

## SES is sandboxed until AWS says otherwise

Verifying the domain here does not take the account out of the SES sandbox. In
the sandbox you may only send to separately verified addresses, capped at 200
messages/day and 1/second; anything else is rejected with `MessageRejected`.
Leaving the sandbox is a manual request (AWS console → Amazon SES → Account
dashboard → *Request production access*), reviewed by a human, typically within
24 hours. There is no Terraform resource and no API for it. The same notice is
in `terraform output ses_production_access_notice`.

## Least-privilege audit

Every statement in `iam.tf` was derived from a call site, not from a service
list. This is the comparison — grep `apps/api/src` for `@aws-sdk/client-*` to
re-run it.

### Task role

| Application call                              | Call site                                        | IAM action granted           | Resource scope        |
| --------------------------------------------- | ------------------------------------------------ | ---------------------------- | --------------------- |
| `PutObjectCommand` (upload + presigned PUT)   | `s3-provider.service.ts` `upload`, `getPresignedUploadUrl` | `s3:PutObject`      | `<uploads bucket>/*`  |
| `GetObjectCommand` (presigned GET)            | `s3-provider.service.ts` `getPresignedUrl`       | `s3:GetObject`               | `<uploads bucket>/*`  |
| `DeleteObjectCommand`                          | `s3-provider.service.ts` `delete`                | `s3:DeleteObject`            | `<uploads bucket>/*`  |
| `HeadObjectCommand`                            | `s3-provider.service.ts` `headObject`            | `s3:GetObject`, `s3:ListBucket` | objects, and the bucket |
| `SendMessageCommand`                           | `webhook-ingest.service.ts`, `webhook-retry.service.ts` | `sqs:SendMessage`     | webhook queue         |
| `ReceiveMessageCommand`                        | `payment-webhook-consumer.service.ts`            | `sqs:ReceiveMessage`         | webhook queue         |
| `DeleteMessageCommand`                         | `payment-webhook-consumer.service.ts`            | `sqs:DeleteMessage`          | webhook queue         |
| `SendEmailCommand` (SES **v1**)                | `ses-mail-transport.service.ts`                  | `ses:SendEmail` + `ses:FromAddress` condition | the domain identity, that one address |
| `PublishCommand`                               | `sns-provider.service.ts` — **no consumer**      | `sns:Publish`                | notification topic    |
| —                                              | —                                                | `ssm:GetParameters`          | `<ssm prefix>/*`      |

`s3:ListBucket` is the one grant that is not one-to-one with a call. S3 answers
a `HEAD` for a missing key with **404 NotFound** only if the caller holds
`s3:ListBucket` on the bucket; without it the answer is **403 AccessDenied**, so
existence is not leaked. `headObject()` branches on `caught.name === 'NotFound'`
and returns `null`; with a 403 it rethrows, and every "does this upload exist?"
check in `file.service.ts` becomes a 500. Read-only, bucket-level, this bucket.

### Execution role

| Purpose                        | IAM action                                                              | Resource scope           |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------ |
| Registry auth for image pull   | `ecr:GetAuthorizationToken`                                             | `*` — see below          |
| Image pull                     | `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage` | this stack's two repositories |
| Container logs                 | `logs:CreateLogStream`, `logs:PutLogEvents`                             | `/aws/ecs/<prefix>*`     |
| Task-definition `secrets`      | `ssm:GetParameters`                                                     | `<ssm prefix>/*`         |

`ecr:GetAuthorizationToken` is the only `"*"` in the module and the only one AWS
accepts: the action supports no resource types, because the token it returns is
for the account's registry as a whole. It yields a token, not image data.

`AmazonECSTaskExecutionRolePolicy` would have replaced this table with one line
— and grants `ecr:BatchGetImage` and `logs:PutLogEvents` on `*`, meaning every
repository and every log group in the account. That is the trade this module
declines.

`logs:CreateLogGroup` is deliberately absent: log groups belong to Terraform, so
they get a retention policy. A group auto-created by the `awslogs` driver
retains forever and bills forever.

### Findings

1. **`s3:*` on the task role is currently dead code.** `S3ProviderService`
   constructs its `S3Client` with explicit static credentials, and
   `s3.config.ts` makes `S3_ACCESS_KEY` / `S3_SECRET_KEY` required (`min(1)`)
   whenever S3 is enabled. A task using this role would still be signing with
   the IAM user's keys. Dropping the `credentials` block so the SDK falls back
   to the container credential provider is a small change in the API, and until
   it lands the least-privilege S3 statements here are aspirational for the
   wrong reason. **The SQS, SNS and SES clients already use the default
   credential chain and do run as this role.**
2. **`sns:Publish` is granted with no caller.** `SnsProviderService` exists and
   is registered, but nothing outside `providers/sns/` injects `SNS_PROVIDER`.
   The topic is an extension point. Remove the statement if you remove the
   provider.
3. **`ssm:GetParameters` matches no SDK call.** Nothing in `apps/api/src`
   imports an SSM client. It is granted because ECS resolves a task
   definition's `secrets` block with the **execution** role before the container
   starts, and it is on the task role too for a runtime read that does not exist
   yet. Path-scoped in both places.
4. **`lambda:InvokeFunction` is granted nowhere, and `LambdaProviderService`
   exists.** No call site injects `LAMBDA_PROVIDER`, so nothing is broken today
   — but setting `LAMBDA_ENABLED=true` and calling `invoke()` would be denied.
   Add a function-scoped statement when there is a function to scope it to.
5. **Multipart S3 actions omitted.** `upload()` uses `PutObjectCommand` with a
   buffered body, which is single-part. Switching to `@aws-sdk/lib-storage`
   would need `s3:AbortMultipartUpload` and `s3:ListMultipartUploadParts`.
6. **`sqs:GetQueueUrl` and `sqs:GetQueueAttributes` omitted.** The queue URL
   comes from configuration and the application never reads queue attributes.
   CloudWatch reads DLQ depth as a service, not as this role.
7. **No IAM for the CloudFront and S3 presigners.** Both
   `@aws-sdk/cloudfront-signer` and `@aws-sdk/s3-request-presigner` sign
   locally. The signature inherits the signer's own permissions, which is why
   `s3:PutObject`/`s3:GetObject` above cover presigned uploads and downloads.

## Notes for the stacks that follow

- The uploads bucket has `force_destroy` only in the disposable profile.
- Nothing reads the DLQ. The observability stack should alarm on
  `ApproximateNumberOfMessagesVisible` on `payment_webhook_dlq_arn` — a DLQ
  nobody watches is a folder of lost payments.
- `local.names.mail_config_set` is unused: an SES configuration set only earns
  its keep once the mail transport passes `ConfigurationSetName`, which it does
  not.
- Without `domain_name` set, the uploads CORS origin list is `["*"]` — the
  frontend hostname is assigned by the edge stack and is not knowable here. The
  presigned signature is what authorizes an upload; CORS is a browser control.
