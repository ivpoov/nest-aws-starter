# example lambda

Echo function demonstrating the API's Lambda invoker pattern
(`LambdaProviderService.invoke()` → `{ echoed: <payload> }`).

Plain ESM JavaScript — no build step. Zip and deploy to LocalStack:

```bash
cd lambdas/example/src
python3 -m zipfile -c /tmp/example-lambda.zip handler.mjs

aws --endpoint-url http://localhost:4567 lambda create-function \
  --function-name starter-example \
  --runtime nodejs22.x \
  --handler handler.handler \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --zip-file fileb:///tmp/example-lambda.zip

aws --endpoint-url http://localhost:4567 lambda invoke \
  --function-name starter-example \
  --payload '{"hello":"world"}' --cli-binary-format raw-in-base64-out /dev/stdout
```

The API e2e suite (`apps/api/test/lambda.e2e-spec.ts`) performs the same deploy +
invoke automatically.
