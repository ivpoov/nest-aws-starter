# Changelog

Every notable change, grouped by [conventional commit](https://www.conventionalcommits.org/)
type. Promotion merge commits are omitted; the commits they carried are not.

**Generated — do not edit by hand.** Regenerate with
`node scripts/changelog.mjs --out CHANGELOG.md`; the release workflow does exactly that.

## v1.3.3 (2026-09-03)

[`v1.3.2...v1.3.3`](https://github.com/ivpoov/nest-aws-starter/compare/v1.3.2...v1.3.3)

### Bug Fixes

- **admin:** hide the accessible chart tables with a wrapper so they stop extending the page ([`3061053`](https://github.com/ivpoov/nest-aws-starter/commit/30610531c78f5fb76c29c8b863bbb6e5b76b46b3))
- **notification:** stop socket fan-out at module destroy, not application shutdown ([`c53caa2`](https://github.com/ivpoov/nest-aws-starter/commit/c53caa2225a013ece520f896ae073c096834c48d))

### Tests

- **admin:** assert the accessible tables are hidden by a wrapper ([`d1d7a8c`](https://github.com/ivpoov/nest-aws-starter/commit/d1d7a8c28ae49b96334d80191ba9dfd4ad68c1fa))
- **notification:** cover both shutdown hooks on the fan-out guard ([`d0e937e`](https://github.com/ivpoov/nest-aws-starter/commit/d0e937e3671b1ea2edc6d5c1d3cf2f925de2d1ba))

## v1.3.2 (2026-09-03)

[`v1.3.1...v1.3.2`](https://github.com/ivpoov/nest-aws-starter/compare/v1.3.1...v1.3.2)

### Bug Fixes

- **deps:** pin fastify, fast-uri, mysql2 and qs past their advisories ([`91ae9bb`](https://github.com/ivpoov/nest-aws-starter/commit/91ae9bb0f922e76de6741a38a41c464c2681e401))

### CI

- **api:** run the e2e suite against redis cluster as well ([`d0eff8c`](https://github.com/ivpoov/nest-aws-starter/commit/d0eff8ce851bb71494e8831e9e5d716144c37f57))

### Chores

- bump the root package version to 1.3.2 ([`94980c1`](https://github.com/ivpoov/nest-aws-starter/commit/94980c120f92e5d4100460f8c9fb912bf58a6010))

## v1.3.1 (2026-08-18)

[`v1.3.0...v1.3.1`](https://github.com/ivpoov/nest-aws-starter/compare/v1.3.0...v1.3.1)

### Bug Fixes

- **scripts:** stop the changelog duplicating an already-tagged release ([`3cad1bf`](https://github.com/ivpoov/nest-aws-starter/commit/3cad1bf4e3c47c165b95100a6be1903cc84a89a6))

### CI

- **release-check:** re-run when the tag that answers it arrives ([`07fb13a`](https://github.com/ivpoov/nest-aws-starter/commit/07fb13a44a58c97ca6bb0bc0cf4dff439f3a9582))
- run on every branch of the promotion path ([`5cf1d4e`](https://github.com/ivpoov/nest-aws-starter/commit/5cf1d4eac5c1be019c74af7a8eecb481de8dae4e))

### Tests

- **scripts:** cover the changelog section builder ([`40ad774`](https://github.com/ivpoov/nest-aws-starter/commit/40ad77432014597f3703076ac676bdf5bb4f3cde))

### Documentation

- add the generated changelog ([`8619fec`](https://github.com/ivpoov/nest-aws-starter/commit/8619fec758c8714f65f126724805bf1bc3f97cff))

### Chores

- bump the root package version to 1.3.1 ([`4dfbf30`](https://github.com/ivpoov/nest-aws-starter/commit/4dfbf301f0181531b3d0f1be0e70aabc67a57286))

## v1.3.0 (2026-08-18)

[`v1.2.1...v1.3.0`](https://github.com/ivpoov/nest-aws-starter/compare/v1.2.1...v1.3.0)

### Bug Fixes

- **notification:** stop socket fan-out once shutdown has begun ([`8cdd134`](https://github.com/ivpoov/nest-aws-starter/commit/8cdd1345e7dd153d518e6e998b806fb35ae1c804))
- **payment:** refuse to extend the period of a terminal subscription ([`abc8c29`](https://github.com/ivpoov/nest-aws-starter/commit/abc8c29a296781351d1615485daabdf05031771a))
- **shared:** put the client-facing error codes on the wire contract ([`e1fa97a`](https://github.com/ivpoov/nest-aws-starter/commit/e1fa97a1e7977839a2594134943086a2dafe9ad7))
- **shared:** fence the statistic error code to its module ([`4b82b50`](https://github.com/ivpoov/nest-aws-starter/commit/4b82b50e5849f495d82748e97f67b1fe677834af))
- **web,admin:** let a deployment replace the csp https wildcard with its media origins ([`1a640fd`](https://github.com/ivpoov/nest-aws-starter/commit/1a640fd316fecf8e4f582584f2a119744cf3a87b))

### CI

- **api:** gate on measured coverage instead of a test count ([`a0f93ce`](https://github.com/ivpoov/nest-aws-starter/commit/a0f93cee098bbdcd7ad065b9b0895a35327fb76b))

### Tests

- **api:** fail the build when an error code drifts off the contract ([`13d56b9`](https://github.com/ivpoov/nest-aws-starter/commit/13d56b91ab69649ce486b69ad4d53f45ef8d9b86))
- **notification:** cover the fan-out shutdown guard ([`4fe29f9`](https://github.com/ivpoov/nest-aws-starter/commit/4fe29f98f06545bd4be04fb3dff0664d093d94e5))
- **payment:** cover the terminal-status guard on period sync ([`832ea47`](https://github.com/ivpoov/nest-aws-starter/commit/832ea47a0956a7d0fa0ec2da84cff2e6306543cb))
- **web,admin:** cover the configurable csp media origins ([`9297e9d`](https://github.com/ivpoov/nest-aws-starter/commit/9297e9db1d6ae6e1db6c63b1b3921a963cf6e752))

### Documentation

- **conventions:** warn that casl conditions are not enforced by the guard ([`6456021`](https://github.com/ivpoov/nest-aws-starter/commit/6456021f38314d1aee557dd182906917e2d51a20))
- **conventions:** state what the module graph does not enforce ([`34ecd18`](https://github.com/ivpoov/nest-aws-starter/commit/34ecd1812b499b46421b70a9ce96f52effa542d8))
- **readme:** surface the docs site at the top and refresh the spec counts ([`1d3d3b5`](https://github.com/ivpoov/nest-aws-starter/commit/1d3d3b5c28bbf5a1696e4ebeadff4c3e3abfa2be))
- **removal:** refresh the recipes for the new shared exports ([`fd2f60f`](https://github.com/ivpoov/nest-aws-starter/commit/fd2f60f21b6c9f56e363732fc09485b921c5052b))
- **removal:** refresh the recipes for the fenced error codes ([`2f7b70f`](https://github.com/ivpoov/nest-aws-starter/commit/2f7b70f34ab33f70ff697b78fdce5e592b61ea8b))

### Chores

- bump the root package version to 1.3.0 ([`f845aa2`](https://github.com/ivpoov/nest-aws-starter/commit/f845aa215acfa1f6cacf3a40d1692d75c51c7a42))

## v1.2.1 (2026-08-18)

[`v1.2.0...v1.2.1`](https://github.com/ivpoov/nest-aws-starter/compare/v1.2.0...v1.2.1)

### Bug Fixes

- **admin:** centre the page container so wide viewports stop skewing content left ([`cbc02b5`](https://github.com/ivpoov/nest-aws-starter/commit/cbc02b5d09895951b7a89ffc157e6f09a812115e))
- **api:** make the unit specs type-check against the interfaces they mock ([`a6ae8b9`](https://github.com/ivpoov/nest-aws-starter/commit/a6ae8b9436bd152229ce13f6763036145c02caed))
- **deps:** pin deepmerge-ts to 8.0.1 ([`46e6620`](https://github.com/ivpoov/nest-aws-starter/commit/46e66208673e270eae89a2b076ed3653bd553f6b))
- **web,admin:** ship a favicon so every page load stops 404ing ([`306d47f`](https://github.com/ivpoov/nest-aws-starter/commit/306d47f924a139ad8a23ba35f7fb5652f8f2c655))

### CI

- **api:** type-check the unit specs instead of excluding them ([`38dfa93`](https://github.com/ivpoov/nest-aws-starter/commit/38dfa936e8974e00a79b9b21d6b3428d3a30ebf3))
- **codeql:** analyse pushes so alerts reach the security tab ([`af00305`](https://github.com/ivpoov/nest-aws-starter/commit/af00305e7126ea84949e297c8ed44cb165840b05))

### Tests

- **admin:** assert the page container is centred ([`e5519b0`](https://github.com/ivpoov/nest-aws-starter/commit/e5519b050d4760a2cc549a0acfa641d8653b7281))

### Documentation

- **removal:** refresh the payment recipe line numbers ([`5a616c5`](https://github.com/ivpoov/nest-aws-starter/commit/5a616c583219fd546c56d3e05a6d89232c9a8197))

### Chores

- bump the root package version to 1.2.1 ([`783da3c`](https://github.com/ivpoov/nest-aws-starter/commit/783da3c85c79998c5307a899e503b7fb03638d8f))

## v1.2.0 (2026-08-17)

[`v1.0.0...v1.2.0`](https://github.com/ivpoov/nest-aws-starter/compare/v1.0.0...v1.2.0)

### Bug Fixes

- **deps:** raise the nanoid override to 3.3.18 ([`9f04e5f`](https://github.com/ivpoov/nest-aws-starter/commit/9f04e5f4c66000294c3145c7f638fd417890f79b))

### Tests

- **api:** use a distinct refresh grace value in the session and token specs ([`fd29b04`](https://github.com/ivpoov/nest-aws-starter/commit/fd29b043c65745ad8c71a6233b9d3a81c6fad9cc))
- **web:** anchor the layout assertion on main so the footer stays removable ([`478467a`](https://github.com/ivpoov/nest-aws-starter/commit/478467ad3ffa68807fe1c11a3fb37887c4538b5d))

### Documentation

- **conventions:** describe declaration placement in prose instead of a table ([`90fa6f6`](https://github.com/ivpoov/nest-aws-starter/commit/90fa6f6f325fa0a48b294e2e0bb0364a86bf3a1b))
- **conventions:** rewrite the code-style sections as prose ([`f185937`](https://github.com/ivpoov/nest-aws-starter/commit/f185937bc972dec90085b52f6f1c87088d718992))
- **conventions:** recast the anti-pattern tables as review rejections with reasons ([`6f5ee99`](https://github.com/ivpoov/nest-aws-starter/commit/6f5ee996f76cb58cad413b89e1edb2ede2dba272))
- reword the readonly rule ([`16d9f83`](https://github.com/ivpoov/nest-aws-starter/commit/16d9f83dff7ebfe82ec9600877fba0389730237a))

### Chores

- **api:** state the reasoning in two comments without citing internal process ([`33755d8`](https://github.com/ivpoov/nest-aws-starter/commit/33755d86ab42c3823f364472c172143d6295ecdd))
- bump the root package version to 1.2.0 ([`b553ea2`](https://github.com/ivpoov/nest-aws-starter/commit/b553ea2b4d0594d854e794ea3fe24f00ea49e395))

## v1.0.0 (2026-08-10)

[`v0.5.0...v1.0.0`](https://github.com/ivpoov/nest-aws-starter/compare/v0.5.0...v1.0.0)

### Features

- **api:** gate the swagger ui behind an explicit enablement flag and basic auth ([`8310190`](https://github.com/ivpoov/nest-aws-starter/commit/83101904b3ce73e39a09b887f558095d1be82a28))
- **api:** refuse to boot in production with development configuration defaults ([`b0df2ad`](https://github.com/ivpoov/nest-aws-starter/commit/b0df2ad4fbe784bd2ce6d38271d4f567f5996c1c))
- **api:** send json-api security headers on every response ([`2aeb4fe`](https://github.com/ivpoov/nest-aws-starter/commit/2aeb4fe17a9af0bfa99a43f4c6624f324663ca32))
- **api:** serve the swagger ui under its own content security policy ([`8774339`](https://github.com/ivpoov/nest-aws-starter/commit/8774339a98495ad8c5f15d996b54fdd7816f6eac))
- **api:** seed a populated demo dataset for a fresh clone ([`c09a319`](https://github.com/ivpoov/nest-aws-starter/commit/c09a319335c91e6f5c251d60c82b6f154ac5ed9f))
- **api:** add a persistence-agnostic unit of work for composed writes ([`90127ce`](https://github.com/ivpoov/nest-aws-starter/commit/90127ce6776e892f9723b33e2d14cb5f243c8448))
- **api:** give the health probes a response schema in the OpenAPI document ([`3ebbba5`](https://github.com/ivpoov/nest-aws-starter/commit/3ebbba5647f179382d8848bf67b95a336528e04e))
- **api:** register API-key auth as an OpenAPI security scheme ([`1aae0ed`](https://github.com/ivpoov/nest-aws-starter/commit/1aae0ed065ec62de31ed883086b4325fef8fde25))
- **api:** accept any loopback origin for CORS outside production ([`824f802`](https://github.com/ivpoov/nest-aws-starter/commit/824f802ad84fac1e11df31be5fe0fa713131927d))
- **ci:** print the oidc subject a run was issued when assume-role fails ([`8be789e`](https://github.com/ivpoov/nest-aws-starter/commit/8be789e2a2a42955da4949d44f5a79cec88edd34))
- **docs:** load the repository's markdown as the site's content, without copying it ([`6d97db7`](https://github.com/ivpoov/nest-aws-starter/commit/6d97db7ebddb8093046e5266b1de6a147f5c4013))
- **docs:** rewrite the repository's relative markdown links for the web ([`6f8bf52`](https://github.com/ivpoov/nest-aws-starter/commit/6f8bf52bd4c6c8cce5742f34a43cd83dcea51d97))
- **docs:** frame the mermaid diagrams rendered at build time ([`18d9355`](https://github.com/ivpoov/nest-aws-starter/commit/18d9355b698354cef91eca4e3e4287ad9b01dcbe))
- **docs:** configure the starlight site, its sidebar and its link validation ([`9f902ef`](https://github.com/ivpoov/nest-aws-starter/commit/9f902eff5be724860559a36bf633a4163d265e7c))
- **infra:** add the terraform state bootstrap stack ([`820778d`](https://github.com/ivpoov/nest-aws-starter/commit/820778d4881b63c1539255cf3f11e49582f71e15))
- **infra:** add the terraform root stack baseline with cost profiles ([`63fa679`](https://github.com/ivpoov/nest-aws-starter/commit/63fa679d369cf758640da68a19d255049f79a93e))
- **infra:** add the network module vpc, subnets, routing and optional nat ([`8f7a1f0`](https://github.com/ivpoov/nest-aws-starter/commit/8f7a1f03206282ec4265e69faea0f1d94244b6f6))
- **infra:** chain least-privilege security groups from the alb to the data tier ([`a1b0ff2`](https://github.com/ivpoov/nest-aws-starter/commit/a1b0ff2e16e2f783f1c192b75de24ea8fc9fa823))
- **infra:** add the free s3 gateway endpoint and opt-in interface endpoints ([`775709a`](https://github.com/ivpoov/nest-aws-starter/commit/775709a630bf6c753a6a20a14486577e6e6d2207))
- **infra:** gate vpc flow logs behind the cost profile ([`864d14d`](https://github.com/ivpoov/nest-aws-starter/commit/864d14d2606da9d95b14ecb794e6f0d5dd43d988))
- **infra:** expose network ids and security groups as module outputs ([`e59d1c4`](https://github.com/ivpoov/nest-aws-starter/commit/e59d1c41710ea03c4eb07ff91f230b934612b199))
- **infra:** wire the network module into the root stack ([`e84a70f`](https://github.com/ivpoov/nest-aws-starter/commit/e84a70f90bb21b2f560b55c8044839815db9409c))
- **infra:** add a services module with the private versioned uploads bucket ([`d63d3f3`](https://github.com/ivpoov/nest-aws-starter/commit/d63d3f33c8a90116beab2a87e900b6236626b402))
- **infra:** add the payment webhook queue with a dead-letter redrive policy ([`b0742d8`](https://github.com/ivpoov/nest-aws-starter/commit/b0742d846eb08cfeebc64fd6a2a5f89519ea1c0e))
- **infra:** add the notification topic and the ses sending identity ([`270a753`](https://github.com/ivpoov/nest-aws-starter/commit/270a7538289e091d7f9d3bc647d3baf21fa1b27e))
- **infra:** scope the ecs task and execution roles to the resources the api uses ([`6b97ac0`](https://github.com/ivpoov/nest-aws-starter/commit/6b97ac04d548d77bdebb735188335167aabe9140))
- **infra:** wire the services module into the root stack ([`61fb769`](https://github.com/ivpoov/nest-aws-starter/commit/61fb7694b7362e3d0bb78e0fe611ec89559a0b75))
- **infra:** publish both SPA buckets through CloudFront with origin access control ([`c59b590`](https://github.com/ivpoov/nest-aws-starter/commit/c59b5901800008863deca8e7d2ed6a2adbb180d9))
- **infra:** wire the edge module and export the frontend and CORS urls ([`a47f38b`](https://github.com/ivpoov/nest-aws-starter/commit/a47f38bb22bf5ef20c84319bec09a735f48a268d))
- **infra:** add the optional CloudFront distribution in front of the ALB ([`f9d7ddc`](https://github.com/ivpoov/nest-aws-starter/commit/f9d7ddcb18e73acefe667fc554ff1fd0837328ec))
- **infra:** warn when a profile asks for edge logging or waf that nothing supplies ([`d0488b4`](https://github.com/ivpoov/nest-aws-starter/commit/d0488b4a0893c64852e5f78455faea094329a05e))
- **infra:** add the rds postgres instance, subnet group and tls parameter group ([`f5229fd`](https://github.com/ivpoov/nest-aws-starter/commit/f5229fdd9ce05f0a36b30485d6520eee858fae81))
- **infra:** run redis as a task sidecar in demo and elasticache in production ([`a304d05`](https://github.com/ivpoov/nest-aws-starter/commit/a304d0535435f3edbda7fb109cf6a7cef7aefeb2))
- **infra:** generate and store every api secret as an ssm securestring ([`a4b6142`](https://github.com/ivpoov/nest-aws-starter/commit/a4b6142ff477097f5cdc11b001583ce068a2aa6d))
- **infra:** expose the data module endpoints, container secrets and sidecar shape ([`490905c`](https://github.com/ivpoov/nest-aws-starter/commit/490905cbef840beb324a314e6131305b42b09d50))
- **infra:** wire the data module into the root stack ([`b884669`](https://github.com/ivpoov/nest-aws-starter/commit/b884669f35bfc5792bec861bb26bf4a1de412bf9))
- **infra:** add the compute module's ecr repositories with a lifecycle policy ([`fc77504`](https://github.com/ivpoov/nest-aws-starter/commit/fc775042893fa389b21f3f7118e12aa9ef945961))
- **infra:** add the ecs cluster, capacity providers and the two log groups ([`24f4e2c`](https://github.com/ivpoov/nest-aws-starter/commit/24f4e2c4e50149ae2dc0b40079b1681f8fe3f47e))
- **infra:** terminate https at the alb and health check /health/ready ([`0a6bb8a`](https://github.com/ivpoov/nest-aws-starter/commit/0a6bb8a082f045071e430ef0c0c8d72203d11db3))
- **infra:** define the api task with ssm-injected secrets and the redis sidecar ([`d1774cf`](https://github.com/ivpoov/nest-aws-starter/commit/d1774cfd9024a2978bfec641f71d3bc946c3bd9f))
- **infra:** roll the api service out with a circuit breaker and rollback ([`fc808cb`](https://github.com/ivpoov/nest-aws-starter/commit/fc808cbb0658123ea7ba6055a875c80ee2a38bb0))
- **infra:** run migrations as a one-off task before the service update ([`8d7f88b`](https://github.com/ivpoov/nest-aws-starter/commit/8d7f88b568ea726ed2565e91eda91ed589d19a57))
- **infra:** scale the api service on cpu with target tracking ([`f1c8720`](https://github.com/ivpoov/nest-aws-starter/commit/f1c8720aed136a23d052abfa3db9e55e11c0679a))
- **infra:** expose the compute module's registry, service and migration contract ([`8ab268c`](https://github.com/ivpoov/nest-aws-starter/commit/8ab268cf3d5d685f17598960b1b8f92be40ea396))
- **infra:** wire the compute module in and export the alb dns name for the edge ([`35b1851`](https://github.com/ivpoov/nest-aws-starter/commit/35b1851d084cae2a731e1adaa42249860c5b5b7b))
- **infra:** add the observability module with an alert topic of its own ([`74f7a36`](https://github.com/ivpoov/nest-aws-starter/commit/74f7a368b13baab8f7c76b6c6614230d993cefab))
- **infra:** retain the container insights log group and count api error logs ([`9485bdc`](https://github.com/ivpoov/nest-aws-starter/commit/9485bdc2ba89a471a6570987975697b2ad94588d))
- **infra:** alarm on stopped tasks, 5xx rate, database pressure and dead letters ([`3347e4b`](https://github.com/ivpoov/nest-aws-starter/commit/3347e4bba63023f3a3835627731a0a348ced5923))
- **infra:** add an account-wide monthly cost budget on every profile ([`e63f0ac`](https://github.com/ivpoov/nest-aws-starter/commit/e63f0acc8380f89ff29c618f47be3f852df31252))
- **infra:** create the shared access-log bucket cloudfront logging needs ([`3d9e42e`](https://github.com/ivpoov/nest-aws-starter/commit/3d9e42ed5aea3d76f9c8be272e85c77efd8f6036))
- **infra:** expose the observability module's alarm, metric and budget contract ([`7fae712`](https://github.com/ivpoov/nest-aws-starter/commit/7fae712b0b3d5bf436d7ce5cbfa5277f0718da09))
- **infra:** wire the observability module into the root stack ([`7baa8b4`](https://github.com/ivpoov/nest-aws-starter/commit/7baa8b4014c9f2e001500d5e008f45a5479869ed))
- **infra:** trust github actions from one repository and one ref through oidc ([`51fd848`](https://github.com/ivpoov/nest-aws-starter/commit/51fd84839f177978d6c3db1d7e760489696b8861))
- **infra:** scope the deploy role to ecr push, the api service and migrations ([`70d34e4`](https://github.com/ivpoov/nest-aws-starter/commit/70d34e46f04605e7507e1ee7b8efd8ee2cb2efbe))
- **infra:** hand the deploy workflow its inputs through one ssm manifest ([`c318c56`](https://github.com/ivpoov/nest-aws-starter/commit/c318c56e967c172011fab68a0accb8b30a075f7e))
- **infra:** wire the cicd module in and export the repository setup commands ([`a574ece`](https://github.com/ivpoov/nest-aws-starter/commit/a574ecee6d4e1a8ca95c7a19b2e24bb8bb236c49))
- **infra:** make managed_cache_enabled an explicit cost profile key ([`5743848`](https://github.com/ivpoov/nest-aws-starter/commit/5743848e12ec0df6aebce0a45aae90f17c7ce35a))
- **infra:** give the private subnet tier its own cost profile key ([`8abe23d`](https://github.com/ivpoov/nest-aws-starter/commit/8abe23dd1635b1a7b44913c21b68d09ffbe9a492))
- **infra:** take the uploads bucket cors origins from the edge, not a wildcard ([`356ad38`](https://github.com/ivpoov/nest-aws-starter/commit/356ad386c61ece018cdbb2bf8a85b619dd7ea3bd))
- **infra:** deliver ALB access logs into the shared log bucket ([`4f41210`](https://github.com/ivpoov/nest-aws-starter/commit/4f41210179a93f4725b58357c4d1b853a2c55a7e))
- **scripts:** fence the note demo module for the subtraction test ([`d0bc2e9`](https://github.com/ivpoov/nest-aws-starter/commit/d0bc2e96c59ca62849bd685362bb0f9a7830cf5a))
- **scripts:** add the bootstrap rename script ([`f316384`](https://github.com/ivpoov/nest-aws-starter/commit/f3163844406d727429ef52de85e157df222ab381))
- **scripts:** rename the local infra fixtures during bootstrap too ([`69a97d7`](https://github.com/ivpoov/nest-aws-starter/commit/69a97d77c2d379715ec59bc6a89387b8804ac12f))

### Bug Fixes

- **account-security:** make the failed-attempt counter and its window one atomic write ([`42f35eb`](https://github.com/ivpoov/nest-aws-starter/commit/42f35eb71d255500e2b7d7e6056f73c05b838627))
- **account-security:** record each lockout scope independently of the other ([`8dbe844`](https://github.com/ivpoov/nest-aws-starter/commit/8dbe844326b54e80c29d282cf7e42beda7fde824))
- **api:** declare dotenv as a runtime dependency ([`349fcf1`](https://github.com/ivpoov/nest-aws-starter/commit/349fcf10fa0b2a187bba62985cbc388fd1398c02))
- **api:** fall back to the aws default credential chain when no static s3 keys are set ([`05aef67`](https://github.com/ivpoov/nest-aws-starter/commit/05aef673c28324398aeab95b90ed13b2a54cc78a))
- **api:** keyset-paginate the filtered contact, transaction and user lists ([`3154f32`](https://github.com/ivpoov/nest-aws-starter/commit/3154f32e6a499daf948ea872ae331ae57e36f889))
- **api:** cap the five list endpoints that returned an unbounded result set ([`79c4387`](https://github.com/ivpoov/nest-aws-starter/commit/79c4387eeb67b0bf622d45f882d583cffb6df037))
- **api:** import reflect-metadata explicitly in both test bootstraps ([`6959f87`](https://github.com/ivpoov/nest-aws-starter/commit/6959f87fc693b81de84ca7c618e8f5230d8d1411))
- **api:** keep oauth credentials out of urls and request logs ([`0ee60da`](https://github.com/ivpoov/nest-aws-starter/commit/0ee60dab1d46900f3b3f667286a3c86571b35e84))
- **api:** fail the demo seed closed on environment and database host ([`27c7833`](https://github.com/ivpoov/nest-aws-starter/commit/27c7833bcc9a2b9496c2d3f88dfa5360ba507832))
- **api:** drop the AGPL ua-parser-js dependency and gate licences in CI ([`1b52cd1`](https://github.com/ivpoov/nest-aws-starter/commit/1b52cd12e1b48ab4d2d07cdb32b60ae6d94372ff))
- **api:** redact credentials echoed back inside http failure messages ([`be24294`](https://github.com/ivpoov/nest-aws-starter/commit/be24294834c6ab558eb688a0008d0fb273774d69))
- **api:** restrict the seed's host allowlist to loopback addresses ([`5c38783`](https://github.com/ivpoov/nest-aws-starter/commit/5c3878318ec076a2339410d421697d5a43e0ab62))
- **api:** match user-agent product tokens on boundaries and name in-app browsers ([`705c8fe`](https://github.com/ivpoov/nest-aws-starter/commit/705c8fecdf4b47b17604f6607dd598d20a5853f4))
- **api:** aggregate revenue statistics as bigint so large buckets stop erroring ([`04238e4`](https://github.com/ivpoov/nest-aws-starter/commit/04238e4857a5e5b524045131ff191d1b988d3f7b))
- **api:** keep subscriptions and transactions when a user row is deleted ([`91a16a1`](https://github.com/ivpoov/nest-aws-starter/commit/91a16a1d1eab2e728b43ca1ce9fcb4b05545789a))
- **api:** bound the subscription expiry and admin receipt backfill sweeps ([`dea8849`](https://github.com/ivpoov/nest-aws-starter/commit/dea88497b6f99987560c5898ae6ce917788cccb1))
- **api:** store token digests in the Redis allowlist instead of the tokens ([`b8c0202`](https://github.com/ivpoov/nest-aws-starter/commit/b8c0202c03d8a82077d8fa2792c91f23e1e1773f))
- **api:** stop the pre-digest fallback from bricking an already-digested key ([`f8fb637`](https://github.com/ivpoov/nest-aws-starter/commit/f8fb6377dd3ad0fca6c6cd215047cb69f8229a85))
- **api:** sum the revenue total as bigint so it stays exact and bounded ([`093e5e5`](https://github.com/ivpoov/nest-aws-starter/commit/093e5e5c263e6ccf681f53bb05c7ff11f89f3a1f))
- **api:** search for LIKE wildcards literally in the admin user search ([`f472bc1`](https://github.com/ivpoov/nest-aws-starter/commit/f472bc1533dda5fbce858f1b8442e55c65e51108))
- **api:** type the query-logging client so the e2e suite type-checks ([`4a92820`](https://github.com/ivpoov/nest-aws-starter/commit/4a9282007778521130e74dfefeb084adaafa740b))
- **api:** fence the payment index assertions so the module stays removable ([`7bc4f54`](https://github.com/ivpoov/nest-aws-starter/commit/7bc4f54b2484d974e93a8b9b3295a88e7b0eacff))
- **api:** guard auth-method unlinking with a row lock so an account keeps a way in ([`d32ad03`](https://github.com/ivpoov/nest-aws-starter/commit/d32ad035ccbd0213f48963bf2f047d8c5f0f6135))
- **api:** pin every session key of a user to one cluster slot ([`c6f7fbe`](https://github.com/ivpoov/nest-aws-starter/commit/c6f7fbe135eef11fe95ee61a12637c95493142c4))
- **api:** rotate refresh tokens atomically over the digest allowlist ([`a1366b9`](https://github.com/ivpoov/nest-aws-starter/commit/a1366b92c096358516e982eefb660a77a1541eb1))
- **api:** apply the account-status gate to the grace-window replay path ([`dd99299`](https://github.com/ivpoov/nest-aws-starter/commit/dd99299bc37969d1ad08cf3a1a675e1b3776b12b))
- **api:** derive the refresh grace window from one round trip instead of 30 seconds ([`7db9305`](https://github.com/ivpoov/nest-aws-starter/commit/7db93051bafbf86d66675ca98f385b4c826ede32))
- **api:** mark the three authenticated auth endpoints as bearer-authenticated ([`0de3186`](https://github.com/ivpoov/nest-aws-starter/commit/0de318650e5f0f741fe57ff1075559e19f7c968d))
- **api:** carry tls and url credentials to every discovered cluster node ([`d7a2210`](https://github.com/ivpoov/nest-aws-starter/commit/d7a221061f5dcd5518cd5f3696b49b56f9b8ee54))
- **api:** populate the cluster slot map before fanning out over its masters ([`b736c2b`](https://github.com/ivpoov/nest-aws-starter/commit/b736c2b810c01cb44046df30fd554776fab20428))
- **api:** walk every cluster master when listing account lockouts ([`1a16999`](https://github.com/ivpoov/nest-aws-starter/commit/1a16999a63c9fe37e7a349312b22bc7d6eed8e3c))
- **api:** release a lockout with single-key deletes so cluster mode succeeds ([`b0c7631`](https://github.com/ivpoov/nest-aws-starter/commit/b0c76319a725c5fb88ed795451c6abdca93bfac8))
- **api,admin:** reconcile the revenue-by-plan breakdown with the revenue total ([`1d7fe89`](https://github.com/ivpoov/nest-aws-starter/commit/1d7fe899b09fae29d89341599a0bb0fbf2c78c83))
- **auth:** revoke sessions before writing a new password hash ([`66fe985`](https://github.com/ivpoov/nest-aws-starter/commit/66fe9851745342d112a12b431594eb2f29a6bc1e))
- **bootstrap:** skip tracked symlinks so a pristine clone can be renamed ([`9b0c012`](https://github.com/ivpoov/nest-aws-starter/commit/9b0c01282a9b8795fbcd58706b06dba4db43d924))
- **ci:** fail a deploy started from anything but the default branch ([`67e4347`](https://github.com/ivpoov/nest-aws-starter/commit/67e43478d93a91663c94b65cb62e1cd888dbaa36))
- **ci:** tag the migration image with the commit sha alongside the moving tag ([`dd44035`](https://github.com/ivpoov/nest-aws-starter/commit/dd44035b7058ee44b426d6aaffd9ed99abc6a084))
- **ci:** declare least-privilege permissions on the ci and subtraction workflows ([`b050ab1`](https://github.com/ivpoov/nest-aws-starter/commit/b050ab15293df019df90e7d901fd26887d94cdad))
- **ci:** require the dispatched sha to be an ancestor of the default branch ([`14655b5`](https://github.com/ivpoov/nest-aws-starter/commit/14655b5f3afe8203885242596fdc0ac20d67e32f))
- **deps:** pin hyperid to 4.0.0 to drop the vulnerable uuid from the tree ([`68e22ba`](https://github.com/ivpoov/nest-aws-starter/commit/68e22ba21483b7c08b3eb5c61b499e5f8ddba5e8))
- **deps:** take astro 7.1.0 for the view-transition XSS advisory ([`f99cd13`](https://github.com/ivpoov/nest-aws-starter/commit/f99cd13ca4ac6496557bee51a7275b33e18f5563))
- **docker:** exclude nested .env files from the build context and guard the build ([`69fb501`](https://github.com/ivpoov/nest-aws-starter/commit/69fb501a0ed84685f2f7199d7db2fceaf17b6a78))
- **docker:** search the build context for leaked env files instead of listing them ([`fee930a`](https://github.com/ivpoov/nest-aws-starter/commit/fee930a53d682e8b75e37b0db0074719fc1be366))
- **infra:** deliver cloudfront access logs into the bucket the stack creates ([`0bd6b43`](https://github.com/ivpoov/nest-aws-starter/commit/0bd6b4387a809096e96bfb59edf9a1887ea1ca93))
- **infra:** drop the unused sns:Publish grant from the ecs task role ([`9d5fbbc`](https://github.com/ivpoov/nest-aws-starter/commit/9d5fbbce2721008dd59802fd166ad9b1f01cb7ef))
- **infra:** turn waf_enabled off on both profiles and say what a WAF would actually take ([`0a9eb23`](https://github.com/ivpoov/nest-aws-starter/commit/0a9eb236937808160989bff6fb500bed4c86aaf3))
- **infra:** trust the deploy job's environment subject so the OIDC role can be assumed ([`ed293ba`](https://github.com/ivpoov/nest-aws-starter/commit/ed293ba0362aa0994e4008096d2573ac275ee18e))
- **infra:** pin the redis sidecar image by digest ([`375a6fe`](https://github.com/ivpoov/nest-aws-starter/commit/375a6fe0a88cd1953a697ff4466e9d525e924ba4))
- **infra:** make the trusted oidc subject expressible in both default formats ([`1ff4a48`](https://github.com/ivpoov/nest-aws-starter/commit/1ff4a489de115de7244fd12bf016852b6da0ba2d))
- **oauth:** match the redirect allowlist by exact origin and callback path ([`1751e67`](https://github.com/ivpoov/nest-aws-starter/commit/1751e67aaf33841b16de525b3598cae98c82dce1))
- **payment:** make the cancel, renewal and failure paths atomic ([`d2374b4`](https://github.com/ivpoov/nest-aws-starter/commit/d2374b4bf77bd2c9505054ab30682c5993ec8f80))
- **scripts:** repoint the CODEOWNERS handle during bootstrap ([`82a6867`](https://github.com/ivpoov/nest-aws-starter/commit/82a68673450d3058e7b106a59cd819c88438a99e))
- **scripts:** rename the lambda spec temp-dir prefix during bootstrap ([`175ba80`](https://github.com/ivpoov/nest-aws-starter/commit/175ba80a2f2536f04b0b3dcb160c24358317656c))
- **scripts:** re-format the tree after bootstrap renames the scope ([`749e97f`](https://github.com/ivpoov/nest-aws-starter/commit/749e97fe5fa07ab5372c3320f2a747da8d3c2bd4))
- **scripts:** fence the path the file and note modules share ([`2f1eba2`](https://github.com/ivpoov/nest-aws-starter/commit/2f1eba276182da9b7569151ccb817e6b2074c09d))
- **scripts:** fail loudly on an unbalanced module fence instead of truncating the file ([`4321e5f`](https://github.com/ivpoov/nest-aws-starter/commit/4321e5f6c4e4bb1f83d4bba2a9f76e9f1b94c649))
- **scripts:** keep admin formatMoney out of the statistic removal set ([`71e1f50`](https://github.com/ivpoov/nest-aws-starter/commit/71e1f503df1fd65207da8acb6584b6a2bde3d258))
- **session:** delete the token allowlist before the session row on revocation ([`138b9a0`](https://github.com/ivpoov/nest-aws-starter/commit/138b9a0b7663ff806846f23967e0d9978323e7f7))
- **web:** push the footer to the bottom on short pages ([`8fdd01f`](https://github.com/ivpoov/nest-aws-starter/commit/8fdd01f206bca69db6eefaa2e9dbae8f11fb143c))
- **web,admin:** ship a Content-Security-Policy with both SPA builds ([`fece943`](https://github.com/ivpoov/nest-aws-starter/commit/fece943384b74083ca57947c61f1bb4fc361baef))
- **web,admin:** annotate the apiClient isPublic parameter type ([`10bfd25`](https://github.com/ivpoov/nest-aws-starter/commit/10bfd251481221215b6cc3022823aac8410e04b8))

### Performance

- **api:** index the payment foreign keys and the date and status list filters ([`d84dfd1`](https://github.com/ivpoov/nest-aws-starter/commit/d84dfd132d3d9f26875aef63834113e70c934df0))
- **api:** make the admin user search index-scannable with trigram indexes ([`db2ea87`](https://github.com/ivpoov/nest-aws-starter/commit/db2ea87d63fbe2f5b62554129df0adc46b80b4d0))

### Refactoring

- **api:** return the parsed value from the config schema validator ([`235aa00`](https://github.com/ivpoov/nest-aws-starter/commit/235aa00f1ad7e5fcb82729a24d823dd58b20ca7c))
- **api:** name every config zod schema configSchema and drop the redundant Required wrapper ([`d199e0a`](https://github.com/ivpoov/nest-aws-starter/commit/d199e0a1c261ce4df4ae85c4aa6864758b7e9187))
- **api:** name the notification unread receipt filter for what it returns ([`fde1947`](https://github.com/ivpoov/nest-aws-starter/commit/fde194733d8a20ddc536b95e5c5a0a4e33671e35))
- **api:** name the evicted memory cache entry by its LRU role ([`14d1ee9`](https://github.com/ivpoov/nest-aws-starter/commit/14d1ee90ccf6c063dbd55ab477ea341141826e30))
- **api:** hold the transaction client in a WeakMap instead of on the handle ([`47aadca`](https://github.com/ivpoov/nest-aws-starter/commit/47aadca73e80c6c7fbfb4483f5825ed83642174a))
- **api,shared:** rename the suspicious-activity module to account-security ([`bc3d86b`](https://github.com/ivpoov/nest-aws-starter/commit/bc3d86b8da4beb1f939e0ae3f78cf1d9682529fa))
- **api,web:** say what a contact notification is about in its title ([`70480e6`](https://github.com/ivpoov/nest-aws-starter/commit/70480e64086b6841e1cca466e82a28a8e570dda6))
- **api,web,admin:** rename the notification dispatcher to the module's event subscriber ([`6338dca`](https://github.com/ivpoov/nest-aws-starter/commit/6338dca1f3a4e179b00ce81179c10a67e3b6c645))
- **infra:** take every derived name from local.names ([`4c16433`](https://github.com/ivpoov/nest-aws-starter/commit/4c16433931d8a22ee3d2ed27a59d5464a9f854f7))
- **infra:** name the payment webhook queue and topic for what they carry ([`791dead`](https://github.com/ivpoov/nest-aws-starter/commit/791dead023363275988e155a3900f8259ffdf554))
- **infra:** drop local.names keys with no resource behind them ([`0419087`](https://github.com/ivpoov/nest-aws-starter/commit/0419087d71245bbefb4c0586456b6ee6a90aa815))
- **infra:** drop the unread synthetics_canary_enabled profile key ([`f6d5633`](https://github.com/ivpoov/nest-aws-starter/commit/f6d5633c1b6c4e5c0766348f54f163c82a96b08c))
- **scripts:** export the subtraction machinery for reuse ([`6086284`](https://github.com/ivpoov/nest-aws-starter/commit/6086284a2f097f073ea7090cb511b457d6489245))
- **shared:** rename statistics totals revenue to revenueCents ([`e421290`](https://github.com/ivpoov/nest-aws-starter/commit/e4212907601280a44b1170a5457e18a1024d60a3))
- **web:** derive the app home route from the nav items ([`66e1648`](https://github.com/ivpoov/nest-aws-starter/commit/66e1648d7dd0e5e138394bea6caeb5ee9df6c203))
- **web,admin:** make formatMoney the single money formatter in each app ([`4716eb1`](https://github.com/ivpoov/nest-aws-starter/commit/4716eb185603e7b81c6df67a1e88af65b08bb675))

### Build

- **api:** add a multi-stage production dockerfile ([`bb28d1c`](https://github.com/ivpoov/nest-aws-starter/commit/bb28d1c832fdc67df9a645b62ce7687c7b92f45b))
- **docs:** run the site build as a docs:build task outside the default fan-out ([`86f49de`](https://github.com/ivpoov/nest-aws-starter/commit/86f49dee4264e5ca2ea1b76565ce6e22db08de44))

### CI

- **docs:** publish the documentation site to github pages from main ([`b2ea839`](https://github.com/ivpoov/nest-aws-starter/commit/b2ea8391fc2d01da06f467280a10cc1b9bb8e0ff))
- scan the full git history for leaked secrets ([`cda1280`](https://github.com/ivpoov/nest-aws-starter/commit/cda1280ba63a18aa431423c39eca0326d9346999))
- add an osv dependency scan alongside pnpm audit ([`0e57707`](https://github.com/ivpoov/nest-aws-starter/commit/0e577078d053aac4a151d29a53155051e1c7e55d))
- add codeql analysis for javascript and typescript ([`77baa50`](https://github.com/ivpoov/nest-aws-starter/commit/77baa509fcb9400f8029ee60a6efcd34e0d41a65))
- pin every action in the ci and subtraction workflows to a commit sha ([`d529da6`](https://github.com/ivpoov/nest-aws-starter/commit/d529da66a3fdda72fa3c004fe21451e79c7c474e))
- allowlist the entropy-checker hex fixtures in secret scanning ([`9aa9099`](https://github.com/ivpoov/nest-aws-starter/commit/9aa9099f7f7c18146ff00c99d49c8118c5a6cb07))
- allowlist the entropy fixtures under their earlier filename too ([`42ceeb2`](https://github.com/ivpoov/nest-aws-starter/commit/42ceeb238b5a694e3e7f36155c04de9e8d4a5614))
- build the api image on pull requests that touch it ([`5730223`](https://github.com/ivpoov/nest-aws-starter/commit/5730223446b82b68956ce8f04cc9896a988c724f))
- deploy the api and both frontends from main through the oidc role ([`b08a50b`](https://github.com/ivpoov/nest-aws-starter/commit/b08a50bc38c2673c80ab9abed7e761a4940f8aa6))
- allowlist terraform budget notification keys in secret scanning ([`d5af597`](https://github.com/ivpoov/nest-aws-starter/commit/d5af59744f85dff0b4948d85a9c6810b65c2fa34))
- check terraform formatting, validity and lint on every infra change ([`a12c896`](https://github.com/ivpoov/nest-aws-starter/commit/a12c8960ab3d9d78593620bcb90403db453bdaad))
- add a dependency-free conventional-commit changelog generator ([`e5bbcf7`](https://github.com/ivpoov/nest-aws-starter/commit/e5bbcf7f0f83fa3237354d7945123eee95013f08))
- add release guards for tag reuse, branch drift and untagged main ([`3c7abc0`](https://github.com/ivpoov/nest-aws-starter/commit/3c7abc0358e660372aed70a8e9140dceb0eb5fcd))
- open the two promotion pull requests from one dispatch ([`79fc672`](https://github.com/ivpoov/nest-aws-starter/commit/79fc672cb42f1b821fd3ad009ebdd2b0b0bc9180))
- generate the changelog, tag and publish a release from one dispatch ([`ecacbed`](https://github.com/ivpoov/nest-aws-starter/commit/ecacbed2c2b8ac9ab4ba6a425e0f5f259b930aa2))
- fail on main whenever no tag covers its commits ([`8421358`](https://github.com/ivpoov/nest-aws-starter/commit/8421358cf692d47bb94028508bb6c8d67126d720))
- gate removal-recipe drift on every pull request instead of nightly only ([`a599b5b`](https://github.com/ivpoov/nest-aws-starter/commit/a599b5b4f32cbc0cbbe9233c6a204676ee524dbf))

### Tests

- **api:** cover the production boot guard end to end ([`bce21f2`](https://github.com/ivpoov/nest-aws-starter/commit/bce21f2a8d3fb33ce97a2a0431cbeefb8067b50b))
- **api:** cover the security headers end to end ([`b2b4b84`](https://github.com/ivpoov/nest-aws-starter/commit/b2b4b847ef21f6e998eed6970384f36661444686))
- **api:** prove a disallowed origin gets no cors grant ([`63a933a`](https://github.com/ivpoov/nest-aws-starter/commit/63a933a11cc72d43dd8ef6cdfa2c0a10a0f97e84))
- **api:** prove x-forwarded-for cannot move the throttler tracker ([`9b52f2e`](https://github.com/ivpoov/nest-aws-starter/commit/9b52f2e0edc58eb98ec0cdd5589a096ff3731dfd))
- **api:** assert hardened error headers on a core route, not the demo module ([`0dd75d3`](https://github.com/ivpoov/nest-aws-starter/commit/0dd75d34573ba3e7e36b65fb49f0a2db3c4e4580))
- **api:** cover the demo seed's production refusal and idempotency ([`c919620`](https://github.com/ivpoov/nest-aws-starter/commit/c91962094263bae37980b1fb63c4f4cd649a7315))
- **api:** run the e2e suite against its own database and redis index ([`543ce14`](https://github.com/ivpoov/nest-aws-starter/commit/543ce14d57edd2308b054dfcb96a2ea0d9008337))
- **api:** drop the stale webhook backlog neutralizer the isolated database makes dead ([`11985c6`](https://github.com/ivpoov/nest-aws-starter/commit/11985c6f00fb1b6958b723b81bc58daa60887645))
- **api:** wait for the correlated notification instead of the first one on an admin socket ([`3304e09`](https://github.com/ivpoov/nest-aws-starter/commit/3304e099aa8286f9d873d057b6ce4e96bc0714a3))
- **api:** cover the pre-digest allowlist key upgrade against a real redis ([`b75c35b`](https://github.com/ivpoov/nest-aws-starter/commit/b75c35b431ae43b027d78f6cba12bbdb1f2364e1))
- **api:** pin the admin search query plan against a correlated-subquery regression ([`ea53252`](https://github.com/ivpoov/nest-aws-starter/commit/ea53252b3dceabe135e1acb6e48dad35109021ef))
- **api:** verify token signatures against foreign-secret, tampered and expired jwts ([`d8359dd`](https://github.com/ivpoov/nest-aws-starter/commit/d8359dd60bc3a86119d479b08371d4b20d6fe8bc))
- **api:** run the cache integration spec in whichever redis mode it targets ([`d0657a6`](https://github.com/ivpoov/nest-aws-starter/commit/d0657a6f856c01175742e44e016d3f21bfab5e8e))
- **api:** pin the development loopback CORS rule on both transports ([`8d4b38b`](https://github.com/ivpoov/nest-aws-starter/commit/8d4b38b31881a7e957cd246acd3aeeefe3afc434))
- **payment:** prove the cancel path rolls back under an induced mid-unit failure ([`6d17e14`](https://github.com/ivpoov/nest-aws-starter/commit/6d17e144429f6ac89caa8ebcacd8fda53e79d25b))
- **payment:** prove the webhook failure path rolls back under an induced failure ([`4763cc8`](https://github.com/ivpoov/nest-aws-starter/commit/4763cc8b038f382266199b60805297d60feaf85a))
- **session:** pin the clock so the sliding-window assertion cannot race ([`cdbeb56`](https://github.com/ivpoov/nest-aws-starter/commit/cdbeb56c6ffaa620646f0027014168773b7a9d14))
- **session:** prove revocation stays fail-safe under an induced mid-operation failure ([`0f65d98`](https://github.com/ivpoov/nest-aws-starter/commit/0f65d987d2bea6d333ad7d21e0f866384c662b10))

### Documentation

- **adr:** correct the profile key count in ADR 10 and say how to recount it ([`a296486`](https://github.com/ivpoov/nest-aws-starter/commit/a29648665a41833052b7e72331e99d6006656181))
- **adr:** record that the redis allowlist stores token digests ([`84e61a6`](https://github.com/ivpoov/nest-aws-starter/commit/84e61a683245b5c1ca663c62854420c65968ef83))
- **api:** explain why cors runs with credentials disabled ([`b0953e3`](https://github.com/ivpoov/nest-aws-starter/commit/b0953e32e4d4b2527797a73bd62c7c8fead4822f))
- **api:** explain when the static s3 keys are needed and when to unset them ([`1394d6c`](https://github.com/ivpoov/nest-aws-starter/commit/1394d6cba0488da676878b2adec98e24dedd0dd4))
- **api:** pin what the rotation grace entry may hold and correct ADR 0003 ([`014e027`](https://github.com/ivpoov/nest-aws-starter/commit/014e0277bd43f0e6db5334dafaf0d5596f387b50))
- **benchmarks:** drop the exact disk model from the host table ([`8020732`](https://github.com/ivpoov/nest-aws-starter/commit/8020732276409a182cbdc34db196fc1efc0a6863))
- **ci:** correct the rollback guarantee to source revision within the retention window ([`2d05aa5`](https://github.com/ivpoov/nest-aws-starter/commit/2d05aa51a3f92bcfb16e8bdb2b50c88a0e0639af))
- **conventions:** document the frontend conventions for web and admin ([`70b4e28`](https://github.com/ivpoov/nest-aws-starter/commit/70b4e2831c1c25de951a604a912a20a9def426bf))
- **conventions:** document the shared wire-contract conventions ([`3ddf8c6`](https://github.com/ivpoov/nest-aws-starter/commit/3ddf8c6739f825f03de06c0eaf39d23835d78356))
- **conventions:** put e2e specs where they actually live ([`62c4a7e`](https://github.com/ivpoov/nest-aws-starter/commit/62c4a7ed0ab0919d94ed984ac49492f1aa1d5019))
- **conventions:** make the backend code samples match the codebase ([`643e80c`](https://github.com/ivpoov/nest-aws-starter/commit/643e80c9c7627225d27d8c54de4e9fc62b15f81c))
- **conventions:** add the unit-of-work section for composed writes ([`7087542`](https://github.com/ivpoov/nest-aws-starter/commit/7087542d29b0f6d38c0ccf4bdc99909697390852))
- **conventions:** correct the unit-of-work scope and encapsulation claims ([`983ea19`](https://github.com/ivpoov/nest-aws-starter/commit/983ea19a8626aa41163ec719ce246ab35855ecc6))
- **guides:** correct three production statements that drifted from the terraform ([`75533cd`](https://github.com/ivpoov/nest-aws-starter/commit/75533cd2a2def8747b24ad773ce2bb09732a3801))
- **guides:** list the prisma generate prerequisite in the module walkthrough ([`7bcc5f9`](https://github.com/ivpoov/nest-aws-starter/commit/7bcc5f9c3f7907a82e623ad2cbd0fdeabf4e3479))
- **infra:** document the terraform bootstrap and root stack flow ([`a50a6ee`](https://github.com/ivpoov/nest-aws-starter/commit/a50a6ee3f1114d00b9cb576593594c900098db87))
- **infra:** document the network topology, tiers and what costs money ([`6267948`](https://github.com/ivpoov/nest-aws-starter/commit/62679488373eccd4bac2dd1c6c28940c029095c1))
- **infra:** record the services module least-privilege audit ([`fe124ba`](https://github.com/ivpoov/nest-aws-starter/commit/fe124bad20cf5b4eb1017563ef7e390e1c14b61c))
- **infra:** document the edge module's caching, domain and alb trade-offs ([`31c7ec4`](https://github.com/ivpoov/nest-aws-starter/commit/31c7ec4dc0066e1b57e6240a6c2dea748126c272))
- **infra:** document the redis sidecar tradeoff and the aurora serverless alternative ([`88db9ce`](https://github.com/ivpoov/nest-aws-starter/commit/88db9ce4fa95b8d32c2170698198a0045d95b77e))
- **infra:** document the compute module's deploy contract and tuning choices ([`4fcea83`](https://github.com/ivpoov/nest-aws-starter/commit/4fcea83f5cc6cce67cb6565ecfa8d27860554ab8))
- **infra:** document the observability module and the budget default ([`914e1d5`](https://github.com/ivpoov/nest-aws-starter/commit/914e1d5dccbbad355511b201510129a80f40fcf4))
- **infra:** document the oidc trust policy, the deploy manifest and rollback ([`73275ab`](https://github.com/ivpoov/nest-aws-starter/commit/73275abd4a91001f7e81353a21674089229f3b2e))
- **infra:** rewrite the terraform readme and tfvars example for the whole stack ([`04eba20`](https://github.com/ivpoov/nest-aws-starter/commit/04eba202c29349e7a219c9b140d4673488f13f6c))
- **infra:** replace comments that describe work already landed ([`d384b74`](https://github.com/ivpoov/nest-aws-starter/commit/d384b74d1038fbddf13d60079d6064a7cc6d7017))
- **infra:** document the ALB log delivery region knob in terraform.tfvars.example ([`f33f116`](https://github.com/ivpoov/nest-aws-starter/commit/f33f1160329d02299cf3918bd7df39b7c32c8ac9))
- **migrations:** note that pg_trgm is a trusted extension needing no superuser ([`6df0530`](https://github.com/ivpoov/nest-aws-starter/commit/6df05308d564cdcceac5050343624260d7a632f5))
- **removal:** regenerate the recipes after the demo module fences ([`8d6459e`](https://github.com/ivpoov/nest-aws-starter/commit/8d6459e25478d1fa95ead3ce4e2de256bc971c90))
- **removal:** regenerate the fence line references after the data-layer changes ([`dd9ea26`](https://github.com/ivpoov/nest-aws-starter/commit/dd9ea265dfd5c00f6c866806d127455c376c8876))
- **removal:** regenerate the file recipe after the maintenance-jobs fences moved ([`86ca587`](https://github.com/ivpoov/nest-aws-starter/commit/86ca58733470c9b4351ad1256a7c551c22d489ff))
- **security:** list the hyperid override among the advisories fixed rather than suppressed ([`0be8ae6`](https://github.com/ivpoov/nest-aws-starter/commit/0be8ae600dabfac4614ce1f0cd2479297c5d75f0))
- add security policy with private advisory reporting ([`a85f3dd`](https://github.com/ivpoov/nest-aws-starter/commit/a85f3ddccfb76f97c5fb1fd63fa444bbed219b3f))
- link the license and security policy from the readme ([`76ed601`](https://github.com/ivpoov/nest-aws-starter/commit/76ed6018756d81b4eda756e12e432fd73779acfb))
- add a contributing guide ([`36199d5`](https://github.com/ivpoov/nest-aws-starter/commit/36199d563659c2c6fb186d6784ffcd6998080eeb))
- document the production boot guard and its entropy check ([`7d3d76b`](https://github.com/ivpoov/nest-aws-starter/commit/7d3d76babeae70254e39b0f9cea0a08adc5fce93))
- document the api response security headers ([`2d3bde2`](https://github.com/ivpoov/nest-aws-starter/commit/2d3bde201ef115c2259579b90c200807a70504e1))
- document building and running the api container image ([`84ee6df`](https://github.com/ivpoov/nest-aws-starter/commit/84ee6df038650cf90be63d9c0102d8e515fd0972))
- document the full compose profile and the image build job ([`a83a502`](https://github.com/ivpoov/nest-aws-starter/commit/a83a5020f82a8b0b2e55a221ca05641732cda7af))
- document the bootstrap rename command ([`d5a2657`](https://github.com/ivpoov/nest-aws-starter/commit/d5a26575a18d3ad3c82482c2f504d991e6a7377b))
- regenerate the removal recipes for the demo seed fences ([`bb3039b`](https://github.com/ivpoov/nest-aws-starter/commit/bb3039bb0675747a7bba27575d843f316c5a40f5))
- cross-link the three convention files and point workflow rules at contributing ([`046f99d`](https://github.com/ivpoov/nest-aws-starter/commit/046f99d34ae35eb82c8387f30bc135e490eb5918))
- record the contracts-over-implementations decision ([`17e8667`](https://github.com/ivpoov/nest-aws-starter/commit/17e8667fd45263d95941f74b04e3e02c7c03de93))
- record the fastify-over-express decision and its costs ([`c9d99c6`](https://github.com/ivpoov/nest-aws-starter/commit/c9d99c60bbc47cda00cc308694928f610de226ac))
- record the tokens-in-redis decision and its postgres exceptions ([`5e8ff07`](https://github.com/ivpoov/nest-aws-starter/commit/5e8ff077b2acd7addd8614a6e2479b3c656353ca))
- record the bearer-token decision and its xss trade-off ([`d95c44c`](https://github.com/ivpoov/nest-aws-starter/commit/d95c44c7a2943421cb209e10930c9df61025b7ae))
- record the cursor-pagination decision ([`99b5c7a`](https://github.com/ivpoov/nest-aws-starter/commit/99b5c7a480b4a606d8cef5b088b38567767e8ec2))
- record the uuidv7 primary key decision ([`94cdbc9`](https://github.com/ivpoov/nest-aws-starter/commit/94cdbc93d9806a6ff76541d295b0bc1124065408))
- record the esm-only decision ([`a35e7a6`](https://github.com/ivpoov/nest-aws-starter/commit/a35e7a676074039213082f27538bb4e498b2f402))
- record the modular-by-subtraction decision ([`e23844c`](https://github.com/ivpoov/nest-aws-starter/commit/e23844c0f0404db572c675248ddf977ff22d35d8))
- record the thirty-day dependency soak decision ([`b902506`](https://github.com/ivpoov/nest-aws-starter/commit/b90250640f75b5446ec508e4b65ac18fad4d5349))
- record the two cost profiles and the no-nat trade-off ([`92895ac`](https://github.com/ivpoov/nest-aws-starter/commit/92895ace28be3e3f290cbc38cef4ef380511ba53))
- index the architecture decision records ([`9c5c762`](https://github.com/ivpoov/nest-aws-starter/commit/9c5c7622b8351a40d7bfbfc67c02e6f870aa7cfb))
- add the architecture overview with a generated event-bus map ([`524352f`](https://github.com/ivpoov/nest-aws-starter/commit/524352f00fa94e9b285d597b0287fefab53eb855))
- point the readme at the architecture doc and the decision records ([`38ca52d`](https://github.com/ivpoov/nest-aws-starter/commit/38ca52d78d8ae595b59a906549c17741f24972fe))
- add an end-to-end walkthrough for building a feature module ([`8333902`](https://github.com/ivpoov/nest-aws-starter/commit/833390254bd3da5054be84dc35b32baaef9634e8))
- link the module walkthrough from the readme and architecture overview ([`d5bfed9`](https://github.com/ivpoov/nest-aws-starter/commit/d5bfed93427a6a06ea3a1d0ee552595404182ac9))
- add a production runbook for the AWS stack ([`b6a01cd`](https://github.com/ivpoov/nest-aws-starter/commit/b6a01cd1f719af20782e890a58c8acf93b1a5ff0))
- link the production runbook from the readme ([`eae1e24`](https://github.com/ivpoov/nest-aws-starter/commit/eae1e2489813d3523bfa5976a5048199fb53d87b))
- link the production runbook from the architecture overview ([`566addf`](https://github.com/ivpoov/nest-aws-starter/commit/566addff5aa410157c207b095f118271e2cfb6b4))
- add web and admin screenshots captured against the demo seed ([`31a15a5`](https://github.com/ivpoov/nest-aws-starter/commit/31a15a5e6ae0fc3671f68974476292f04116abdc))
- publish the measured API benchmark numbers with their limits ([`6990cde`](https://github.com/ivpoov/nest-aws-starter/commit/6990cde3f76e7bd6f0d134ef7e7394c6906c505f))
- rewrite the README as a public landing page for the finished starter ([`1ff8772`](https://github.com/ivpoov/nest-aws-starter/commit/1ff87722c7f7d15cf482d7038b325cfbb510dbcb))
- correct the removal-recipe drift claim and define fence at first use ([`d05f0f4`](https://github.com/ivpoov/nest-aws-starter/commit/d05f0f483bcaec954117940578f1bcea85750c7e))
- add a Contributor Covenant code of conduct ([`8e03aba`](https://github.com/ivpoov/nest-aws-starter/commit/8e03aba646ffe3c386db3ad715664145742e4228))
- add the documentation site to the repository map and document its Chrome prerequisite ([`37c309a`](https://github.com/ivpoov/nest-aws-starter/commit/37c309a5d6375fca24425cc30072b7ee6307d2db))
- replace ADR 0008's stale fence counts with the commands that produce them ([`3067ab7`](https://github.com/ivpoov/nest-aws-starter/commit/3067ab7682a5775528c11c50da85b2c436ec5705))
- correct ADR 0007's claims about interop, reflect-metadata and import linting ([`0e53c47`](https://github.com/ivpoov/nest-aws-starter/commit/0e53c47ce72e1e54dd7c45eb5ffff7f501418365))
- rewrite the production guide's WAF section around what the stack actually builds ([`43efec9`](https://github.com/ivpoov/nest-aws-starter/commit/43efec97b23e132de303d6d444cc851dd06b5623))
- fix three wrong cross-references and the stale optional-module list ([`fd57cbd`](https://github.com/ivpoov/nest-aws-starter/commit/fd57cbd2996f08e96350827422a202c5526434d4))
- correct which workflows actually run on a pull request ([`4de325b`](https://github.com/ivpoov/nest-aws-starter/commit/4de325bd71f50f366eaeb48dc41d0b641c3baab2))
- record the cluster-mode redis rules and correct the scan fan-out claim ([`99c477b`](https://github.com/ivpoov/nest-aws-starter/commit/99c477ba5216725b350ff2e4ad992fd3c566ffab))
- document the development-only loopback CORS rule ([`104613d`](https://github.com/ivpoov/nest-aws-starter/commit/104613dc9e1689dd631bdde17c25a75dda35c688))

### Style

- **api:** apply biome formatting to the reworked token and user queries ([`b327ba7`](https://github.com/ivpoov/nest-aws-starter/commit/b327ba76ae1e147ba2257b6e775ea01eaade608a))

### Chores

- **api:** add @fastify/helmet and soak-pin its helmet transitive ([`4e958ca`](https://github.com/ivpoov/nest-aws-starter/commit/4e958caf67583406bc1ca352b3be79df2020c5eb))
- **api:** drop internal PR references from payment and stripe comments ([`59ddfcc`](https://github.com/ivpoov/nest-aws-starter/commit/59ddfcce9828ada7ad10f62a6ec99333fc6c87cc))
- **api:** drop internal task references from scheduler and file comments ([`a460370`](https://github.com/ivpoov/nest-aws-starter/commit/a460370018f801b2fe9667e3fcd4bd373da66f7b))
- **api,shared:** drop internal PR references from notification comments ([`a49ebcf`](https://github.com/ivpoov/nest-aws-starter/commit/a49ebcfc8278cf2a81ca2c5031b11a442f2f4d19))
- **compose:** add a full profile that runs the built api image against the dev stack ([`eeb5da4`](https://github.com/ivpoov/nest-aws-starter/commit/eeb5da420c23c577679705ccaf2b3536874a7470))
- **compose:** pin the compose project name instead of inheriting the directory ([`dc066d0`](https://github.com/ivpoov/nest-aws-starter/commit/dc066d09e4e22141814ca38d2a8b0398f4d66ec4))
- **deps:** pin nanoid, shell-quote and @prisma/dev past their advisories ([`4614121`](https://github.com/ivpoov/nest-aws-starter/commit/4614121aff834f90ee4ce47002dcd2cbfa54c516))
- **docs:** add an astro starlight workspace for the documentation site ([`1bd49d2`](https://github.com/ivpoov/nest-aws-starter/commit/1bd49d233b8bd7b3b4c1fc296f8d34c82a8f58cc))
- **lint:** block relative imports in apps/api/src with biome ([`9382724`](https://github.com/ivpoov/nest-aws-starter/commit/938272408ca6a8d6f826f27dfc50b1e90e499329))
- **scripts:** drop internal PR references from the removal docs generator ([`570ea86`](https://github.com/ivpoov/nest-aws-starter/commit/570ea86d7d6777005477b61e5140a239dbac9e3f))
- **security:** allowlist the token repository's jwt-shaped test fixtures ([`afcd085`](https://github.com/ivpoov/nest-aws-starter/commit/afcd0857e6dfb306e4139a8b75e6959d9b32324d))
- add MIT license ([`b608aa6`](https://github.com/ivpoov/nest-aws-starter/commit/b608aa63d9e87819d5c9dbf0d8399afd26f0c140))
- add a pull request template ([`434f8a2`](https://github.com/ivpoov/nest-aws-starter/commit/434f8a24bbcdcdbcd3e1c915395c431eb7f72963))
- add bug report and feature request issue forms ([`01b6a36`](https://github.com/ivpoov/nest-aws-starter/commit/01b6a36b2d5eb852b7d9e207f15c5bf215cc2191))
- route security reports out of the public issue tracker ([`64a49b1`](https://github.com/ivpoov/nest-aws-starter/commit/64a49b176d66d8283d78d436f99d801c4bc555ed))
- assign code ownership to the repository owner ([`e77542d`](https://github.com/ivpoov/nest-aws-starter/commit/e77542d8318ac340d5c666939a2521e6b3b7e8de))
- ignore terraform state, caches and local variable files ([`c7a444c`](https://github.com/ivpoov/nest-aws-starter/commit/c7a444cd893890af47777d502d5398bb0d42355f))
- add autocannon as a benchmarking devDependency ([`484163e`](https://github.com/ivpoov/nest-aws-starter/commit/484163e6cb95d728cb420b2461de3cb8459aae54))
- benchmark health, an authenticated list and a cached endpoint with autocannon ([`9cf54ac`](https://github.com/ivpoov/nest-aws-starter/commit/9cf54acbf0f9845c2113fab02b2e9bf2b5b665eb))
- set the root package version to 1.0.0 ([`4ffa2c8`](https://github.com/ivpoov/nest-aws-starter/commit/4ffa2c8c8cffe34fb7cfddb1201a245191f19400))
- ignore the whole .claude directory, not just settings.local.json ([`c9c6408`](https://github.com/ivpoov/nest-aws-starter/commit/c9c64080679150998162e059ba6b911f59d8bd7d))
- declare the MIT license in every workspace manifest ([`cfa853b`](https://github.com/ivpoov/nest-aws-starter/commit/cfa853b712bdbd9a95d1366b5d252324a29c6067))
- bump the root package version to 1.1.0 ([`1b914ec`](https://github.com/ivpoov/nest-aws-starter/commit/1b914ecc70403633ab5b12b5d69110fbd5ef242a))

## v0.5.0 (2026-08-09)

[`v0.4.0...v0.5.0`](https://github.com/ivpoov/nest-aws-starter/compare/v0.4.0...v0.5.0)

### Features

- **admin:** add the notification socket hook with an unread-count poll ([`3064dc1`](https://github.com/ivpoov/nest-aws-starter/commit/3064dc1d98c930b21bb07fb88a4248a0fc345142))
- **admin:** add the notification bell, dropdown, and list hook ([`fc60f9a`](https://github.com/ivpoov/nest-aws-starter/commit/fc60f9af2117d4a2eac581172bebe798a72a60bf))
- **admin:** add the notification history page with type/audience filters ([`be9c4ce`](https://github.com/ivpoov/nest-aws-starter/commit/be9c4ce0ba3e51461e63b777f10e1c499bf9001b))
- **admin:** wire the notification bell and history route into the admin shell ([`084f862`](https://github.com/ivpoov/nest-aws-starter/commit/084f8623a2cfe24c32fc0874929eebc17f7f3174))
- **admin:** deep-link contact message notifications to the inbox item ([`5e53ca8`](https://github.com/ivpoov/nest-aws-starter/commit/5e53ca812b401cc91828f736b4be8ff65b22a553))
- **admin:** surface socket connection state in the notification dropdown ([`bc526fe`](https://github.com/ivpoov/nest-aws-starter/commit/bc526fed996615f532380753bbbeb1ad7dd9c786))
- **admin:** deep-link the user-blocked and suspicious-login notification types ([`5443aee`](https://github.com/ivpoov/nest-aws-starter/commit/5443aee8714e6fb67907e4898deccb2b2c55deb1))
- **api:** add notification data model ([`6c925e6`](https://github.com/ivpoov/nest-aws-starter/commit/6c925e6c7f7f62ad22f5ace366fc08d830b926cb))
- **api:** add websocket gateway config ([`efec3a8`](https://github.com/ivpoov/nest-aws-starter/commit/efec3a82ac6aef580557f009567e6a20e74ceaf7))
- **api:** add notification gateway with jwt handshake auth ([`345ac58`](https://github.com/ivpoov/nest-aws-starter/commit/345ac58071dbdd26f0f79206ccd498c62c6fac5b))
- **api:** wire redis-backed socket.io adapter ([`5391dd3`](https://github.com/ivpoov/nest-aws-starter/commit/5391dd378a98ae36dd223a9b21d8ce3967c35bb9))
- **api:** add notification domain contracts and event payload interfaces ([`8b2f60b`](https://github.com/ivpoov/nest-aws-starter/commit/8b2f60bec024bafa7a6af35d8e533908d64db91a))
- **api:** add notification content builders per matrix type ([`ec2e1d8`](https://github.com/ivpoov/nest-aws-starter/commit/ec2e1d84602313c2135cc838fb9943bd6d93415b))
- **api:** add notification prisma repository ([`7a7600b`](https://github.com/ivpoov/nest-aws-starter/commit/7a7600bc4d67d60cbbf1ee6aee1bafadff5b59fc))
- **api:** add persist-first notification dispatcher service ([`750d6e2`](https://github.com/ivpoov/nest-aws-starter/commit/750d6e29a3628302f2edd581b26322ef091c7870))
- **api:** add webhook.failed core event constant ([`fceea4b`](https://github.com/ivpoov/nest-aws-starter/commit/fceea4b35f38ab6fe243d21d77ce286dca15b793))
- **api:** emit webhook.failed at the payment consumer retry ceiling ([`a452029`](https://github.com/ivpoov/nest-aws-starter/commit/a452029ac0d5747a298ba9ef01d203c658e80778))
- **api:** add webhook-failed notification content builder ([`2d01257`](https://github.com/ivpoov/nest-aws-starter/commit/2d0125766910206fa9a20fa3e7818e24d53f4c63))
- **api:** wire webhook.failed into the notification dispatcher ([`a4f41cf`](https://github.com/ivpoov/nest-aws-starter/commit/a4f41cf248f47b7f3b2683902359105917a2e220))
- **api:** add CurrentUser decorator ([`0a2ae8e`](https://github.com/ivpoov/nest-aws-starter/commit/0a2ae8e0378996d5931afb239e47062881bb2f25))
- **api:** add notification history repository methods ([`d7df0c8`](https://github.com/ivpoov/nest-aws-starter/commit/d7df0c86b12f8a876a7bdf7ad369629b24ef1352))
- **api:** wire unread-count emission into the notification dispatcher ([`e3cb41c`](https://github.com/ivpoov/nest-aws-starter/commit/e3cb41caa44d182f8d2d84234577077f50ea0dd8))
- **api:** add notification history service ([`f7c1091`](https://github.com/ivpoov/nest-aws-starter/commit/f7c10916d33e66e3b7360e396398a7ed1663213d))
- **api:** add notification history controller and endpoints ([`5303975`](https://github.com/ivpoov/nest-aws-starter/commit/5303975edf03a0765c537b567ace6b6284da9603))
- **api:** add notification preference repository ([`e3c8a03`](https://github.com/ivpoov/nest-aws-starter/commit/e3c8a03ab82e8f5ceb4bb81793d153de96327fba))
- **api:** add notification preference service ([`3d28857`](https://github.com/ivpoov/nest-aws-starter/commit/3d28857dc578a5c4c7c5e10aa5e637899ffa8c95))
- **api:** add notification email service ([`76ab2d6`](https://github.com/ivpoov/nest-aws-starter/commit/76ab2d656150a3037e51d9144d0ad319f2fce39e))
- **api:** wire the EMAIL channel into the notification dispatcher ([`d6cd30f`](https://github.com/ivpoov/nest-aws-starter/commit/d6cd30ffb4cb3a08ceddec08da056b3d39d0c4bd))
- **api:** add notification preference endpoints ([`9735168`](https://github.com/ivpoov/nest-aws-starter/commit/97351687b1e34facf87401aaee80eefd2e98f73a))
- **notification:** throttle notification emails to one per user, type and hour ([`a9a0107`](https://github.com/ivpoov/nest-aws-starter/commit/a9a01074c27dc9477fbc6347f7aace0ebf7b9a8f))
- **notification:** filter the notification list by type and audience server-side ([`3f9f539`](https://github.com/ivpoov/nest-aws-starter/commit/3f9f539b96c3f49c0932ff87e37a8f28139e5a09))
- **scripts:** extend module removal coverage to the frontends and shared package ([`80c40d1`](https://github.com/ivpoov/nest-aws-starter/commit/80c40d157620875e0a63bcce851ec59ab138715e))
- **shared:** add notification wire enums ([`7adf735`](https://github.com/ivpoov/nest-aws-starter/commit/7adf73521e9bd767b4624c31096e463049c32e21))
- **shared:** add notification response wire contract ([`9a252df`](https://github.com/ivpoov/nest-aws-starter/commit/9a252dfa4745bbe1acc6ec5474834f6e1e80f9fa))
- **shared:** add notification history wire contracts ([`4ed113f`](https://github.com/ivpoov/nest-aws-starter/commit/4ed113fc0794aa07296f437e15ffbcbe7bba6890))
- **shared:** add notification preference wire contracts ([`ff13d42`](https://github.com/ivpoov/nest-aws-starter/commit/ff13d42ea6299265f878011d4451f17f4f951a1f))
- **web:** add put support to the api client ([`f781447`](https://github.com/ivpoov/nest-aws-starter/commit/f78144763100c96416699793c004a4e5015ea84a))
- **web:** add the notifications api module ([`eeab8e0`](https://github.com/ivpoov/nest-aws-starter/commit/eeab8e01aaab3ad4f60ec5fc8d48992023c26551))
- **web:** add the notification socket hook and reducer ([`6f0a5e0`](https://github.com/ivpoov/nest-aws-starter/commit/6f0a5e0f0178693a76646cd9bea7856806192412))
- **web:** add the notification socket context ([`6d7cb6f`](https://github.com/ivpoov/nest-aws-starter/commit/6d7cb6f3d6c8905b1f31f0838aa1d7acd3a4711c))
- **web:** add the notification list hook ([`4d6909b`](https://github.com/ivpoov/nest-aws-starter/commit/4d6909b195d5d78be6c11d35ccd0d7bcf418cfb5))
- **web:** add the notification preferences hook ([`61d9fd8`](https://github.com/ivpoov/nest-aws-starter/commit/61d9fd8401905027149ce55173258ed317aa74e2))
- **web:** add notification type and channel label constants ([`80e8677`](https://github.com/ivpoov/nest-aws-starter/commit/80e8677c180d5cc4285fea6ca6f4f24ef4f2228b))
- **web:** add the notification deep-link resolver ([`5024721`](https://github.com/ivpoov/nest-aws-starter/commit/5024721b1689f90fb902d0373212c6e9c628758c))
- **web:** add the notification bell and dropdown components ([`9708231`](https://github.com/ivpoov/nest-aws-starter/commit/97082318ed4801ec36a6f89c7dd4164ad0120ec5))
- **web:** add the notification preferences grid components ([`1c67510`](https://github.com/ivpoov/nest-aws-starter/commit/1c67510f4dcf1558e5c43d4c367c871fca6ce53b))
- **web:** add the notification preferences page ([`547d870`](https://github.com/ivpoov/nest-aws-starter/commit/547d8704eb261f6c328947b29ef10b1b3d68177f))
- **web:** wire the notification bell and settings route into the app shell ([`972eb35`](https://github.com/ivpoov/nest-aws-starter/commit/972eb35d4eb12c52d53d92cf1494d7c8b47e7b1c))
- **web:** surface socket connection state in the notification dropdown ([`6802024`](https://github.com/ivpoov/nest-aws-starter/commit/680202443c25d414205cd7b83f033fdf41d9a3fd))
- add notification module to subtraction test ([`d4d2bfa`](https://github.com/ivpoov/nest-aws-starter/commit/d4d2bfac1d25c93d9d0d7bcf2fab60c55cdc81ce))
- add notification gateway to subtraction test ([`3272ce8`](https://github.com/ivpoov/nest-aws-starter/commit/3272ce8b58a6dc6c6504f70ddb721c69f1b8eff4))
- extend notification subtraction entry with dispatcher paths ([`0646418`](https://github.com/ivpoov/nest-aws-starter/commit/0646418815050532a5fce73372f2ecb848fee7c4))
- extend notification subtraction entry with history API paths ([`19a4832`](https://github.com/ivpoov/nest-aws-starter/commit/19a4832c800fdbbd69769f90c1442a6a15cb54c2))
- extend notification subtraction entry with preference paths ([`2eef4dc`](https://github.com/ivpoov/nest-aws-starter/commit/2eef4dc7568347e207d58cc2757dd6c1f6c2daad))

### Bug Fixes

- **admin:** resync the inbox deep link when the message id param changes ([`09dc627`](https://github.com/ivpoov/nest-aws-starter/commit/09dc62733bbd4f20f037be5c77574149a0c75ee7))
- **admin:** bound socket reconnects with backoff and a stability-window reset ([`605fc35`](https://github.com/ivpoov/nest-aws-starter/commit/605fc353d1367ea6d7e46fb6c1ab84c254b636c6))
- **admin:** explain the inbox deep link instead of dead-ending on an unloaded message ([`a10ba38`](https://github.com/ivpoov/nest-aws-starter/commit/a10ba38dd82ed2c30f9792577e3868cfe9e98642))
- **admin:** filter the notification history server-side instead of per fetched page ([`b1cb9e3`](https://github.com/ivpoov/nest-aws-starter/commit/b1cb9e3cc6d5f3ca71fbff1ab03503c84669b7af))
- **api:** suppress duplicate webhook.failed emit on redelivery ([`647849d`](https://github.com/ivpoov/nest-aws-starter/commit/647849d7247eb2690fae1657c508315bb7429c94))
- **deps:** override js-yaml to patch the omap cpu advisory ([`df64e12`](https://github.com/ivpoov/nest-aws-starter/commit/df64e120f5fa930358da9a05caea0e63130082de))
- **notification:** cascade notifications and receipts from their owning user ([`457114d`](https://github.com/ivpoov/nest-aws-starter/commit/457114dbbd7bc07dd3fd4ba797e0e52ed17e45ce))
- **notification:** resolve socket cors from the app config instead of the raw env ([`5aedbb0`](https://github.com/ivpoov/nest-aws-starter/commit/5aedbb08abd82d68627a6425708b42b56268d036))
- **notification:** evict sockets that drop during the handshake window ([`790e805`](https://github.com/ivpoov/nest-aws-starter/commit/790e80535ceb855c71210cb3613312d7a4506f14))
- **notification:** install no socket transport when websocket_enabled is false ([`587fed3`](https://github.com/ivpoov/nest-aws-starter/commit/587fed3c61d570c81d709b88a9b85cbb012c2cb4))
- **notification:** bound the admin notification scope to their own account ([`bb8b3ed`](https://github.com/ivpoov/nest-aws-starter/commit/bb8b3edee591a8a6dcb77fc2d4469251b163de08))
- **notification:** treat unreadOnly=false as off in the list query ([`dd80fcc`](https://github.com/ivpoov/nest-aws-starter/commit/dd80fcc591a4aead42a1391dbad6910a5d29d029))
- **notification:** paginate the history feed by keyset so a filter cannot drop a row ([`351dbd0`](https://github.com/ivpoov/nest-aws-starter/commit/351dbd0f2df191530b5dbd13c4ca4dcfd4f4ed7b))
- **scripts:** exclude shared-package deletions from the automated subtraction ([`7df3897`](https://github.com/ivpoov/nest-aws-starter/commit/7df3897a73ddb9c9ee6dcb8dfd0d77779d7e414f))
- **turbo:** declare the generated prisma client as a build output ([`a53c4ca`](https://github.com/ivpoov/nest-aws-starter/commit/a53c4ca65ea3b79ca5306eb9e18641c13749d0f7))
- **web:** bound socket reconnects with backoff and a stability-window reset ([`579ec1a`](https://github.com/ivpoov/nest-aws-starter/commit/579ec1ac3eeb4227ad93ca9563d95630e077375d))
- **web:** poll the unread count and drop the role-corrupting socket push ([`e2b2345`](https://github.com/ivpoov/nest-aws-starter/commit/e2b234595436b9d82cca62d144fa910982b6f8f5))
- **web:** refetch the authoritative unread count after read mutations ([`cc49daa`](https://github.com/ivpoov/nest-aws-starter/commit/cc49daab645f4351485c2df53c68bc02f225fada))
- **web:** route password-changed notifications to the sessions page ([`1719c93`](https://github.com/ivpoov/nest-aws-starter/commit/1719c93f628590f1a88701185afb92c89eeb4e92))
- **web,admin:** discard the socket.connect return value in the reconnect timer ([`47affb0`](https://github.com/ivpoov/nest-aws-starter/commit/47affb0ec108c1bc137bd6016bf213db106d2d06))
- **web,admin:** make the notification bell and dropdown keyboard and screen-reader accessible ([`3be049f`](https://github.com/ivpoov/nest-aws-starter/commit/3be049f615d568b4a9dcba2777ea687cb4bcb032))

### Refactoring

- **api:** extract the notification fan-out orchestrator ([`ff64f40`](https://github.com/ivpoov/nest-aws-starter/commit/ff64f4076e6871805b59bc2c1e31db931251610a))
- **web,admin:** annotate the notification api and socket hook locals ([`46f9f34`](https://github.com/ivpoov/nest-aws-starter/commit/46f9f346bd1b8459347afdd4e67c7215d59cb6ea))
- **web,admin:** drop the never-read live notification buffer ([`d3b0dc2`](https://github.com/ivpoov/nest-aws-starter/commit/d3b0dc200f085302417fdb00a1d5b0efc80614dd))
- **web,admin:** type the notification list request with the shared query contract ([`87e5a24`](https://github.com/ivpoov/nest-aws-starter/commit/87e5a240aaabdf89163734fc5c075d0b60d00503))

### CI

- type-check the api e2e suite on every pull request ([`b7e95c4`](https://github.com/ivpoov/nest-aws-starter/commit/b7e95c41f8e7a931fdb8cb93739efc6d909ac8a2))

### Tests

- **admin:** cover the notification socket hook and reducer ([`0d44a9d`](https://github.com/ivpoov/nest-aws-starter/commit/0d44a9dde4848933a5f7ba166dd0aa56077fc489))
- **admin:** cover the notification bell, list hook, and deep-link resolver ([`8aeaea0`](https://github.com/ivpoov/nest-aws-starter/commit/8aeaea095ecb621b0c324aacfc181c8c3fc633c3))
- **admin:** cover the notification history filters and page ([`fc6ffed`](https://github.com/ivpoov/nest-aws-starter/commit/fc6ffedcf6501f9009c5aace262b67ee3fbc03b6))
- **admin:** cover the inbox contact-message deep link ([`9d544ea`](https://github.com/ivpoov/nest-aws-starter/commit/9d544ea57f1f38a942f759fe13bd20afb14dc687))
- **admin:** cover a second inbox deep link without remounting ([`c80937a`](https://github.com/ivpoov/nest-aws-starter/commit/c80937a62e4f2e4d551272493387f0a0ab9bcd64))
- **admin:** derive the admin home route from the nav so removing statistic cannot break it ([`f32da10`](https://github.com/ivpoov/nest-aws-starter/commit/f32da1052ec0663d1f45326dc0ae165f2a4ac6c5))
- **api:** add notification gateway and redis adapter unit tests ([`abb50c4`](https://github.com/ivpoov/nest-aws-starter/commit/abb50c485d499054a7632a41f8b04e7832154b09))
- **api:** add websocket e2e coverage ([`66de4b5`](https://github.com/ivpoov/nest-aws-starter/commit/66de4b59d5d6e431096bc2b049dcc98918e26adc))
- **api:** cover notification dispatcher matrix and persist-first ordering ([`5573149`](https://github.com/ivpoov/nest-aws-starter/commit/55731498d551188897f77db4c16619cfb41a85cf))
- **api:** add notification dispatcher e2e coverage ([`b6d7917`](https://github.com/ivpoov/nest-aws-starter/commit/b6d79174d3114a7bf32134e4efb9498bb8b4286f))
- **api:** assert an admin notification lands at the webhook failed ceiling ([`e284a88`](https://github.com/ivpoov/nest-aws-starter/commit/e284a88443727ccc79721cfbe98f0a7ca0873596))
- **api:** cover unread-count emission in the notification dispatcher ([`51a0600`](https://github.com/ivpoov/nest-aws-starter/commit/51a06000894656ae7fd2e84f76eade5037057371))
- **api:** cover the notification history service ([`9e66887`](https://github.com/ivpoov/nest-aws-starter/commit/9e66887572e9f1a20e2c3631b06c7fc8cdecfe26))
- **api:** add notification history API e2e coverage ([`8d57acd`](https://github.com/ivpoov/nest-aws-starter/commit/8d57acd743ff5573cdb5ceae606fdf9254f2f2cf))
- **api:** cover the notification preference service ([`9af8c4b`](https://github.com/ivpoov/nest-aws-starter/commit/9af8c4b4eaab478f8c3c4afe681accd7f338855e))
- **api:** cover the notification email service ([`af47a11`](https://github.com/ivpoov/nest-aws-starter/commit/af47a11f4223a837eab7dfc628f24e41986bd899))
- **api:** cover the EMAIL channel in the notification dispatcher ([`2bdc897`](https://github.com/ivpoov/nest-aws-starter/commit/2bdc89758b2122db8edbcb4ddc36cca68e50b221))
- **api:** add notification preferences e2e coverage ([`06cbf89`](https://github.com/ivpoov/nest-aws-starter/commit/06cbf8932ddc8c6d9149d923c46ccc967f990957))
- **api:** cover a mixed valid/invalid PUT batch ([`e677c97`](https://github.com/ivpoov/nest-aws-starter/commit/e677c976795ecc4822ee8247c7c1f1fd87ee6a8d))
- **api:** cover a mixed valid/invalid PUT batch e2e ([`76cfb43`](https://github.com/ivpoov/nest-aws-starter/commit/76cfb4322b86743da810cd1da7bf0f00a2a27aff))
- **api:** poll for activity rows in the activities e2e ([`975a916`](https://github.com/ivpoov/nest-aws-starter/commit/975a916faa297982072693c498ee154b9cee1430))
- **api:** type-check the e2e suite via a dedicated tsconfig ([`2ba755e`](https://github.com/ivpoov/nest-aws-starter/commit/2ba755eb2e66d81f48ac75a659dbd8088bc6bda8))
- **notification:** prove the persisted row survives a failing socket fan-out ([`223d97a`](https://github.com/ivpoov/nest-aws-starter/commit/223d97a9a80f3f21146b9f8e57ea9bf95e4c5c6f))
- **notification:** fence the frontend cross-references and verify both spas on removal ([`a6dbe09`](https://github.com/ivpoov/nest-aws-starter/commit/a6dbe09fb5ef044a46f3b7d1722671eab3b44a08))
- **notification:** add the three module-owned spec/constant files missing from the removal paths ([`95b480e`](https://github.com/ivpoov/nest-aws-starter/commit/95b480e7d847fd294438c52baadfb7218be6bcfa))
- **notification:** cover a cursor page whose cursor row left the filter ([`c3888fe`](https://github.com/ivpoov/nest-aws-starter/commit/c3888fe8b9a57b6fd5631f28014097898ec1c8ed))
- **payment:** fence the frontend cross-references and verify both spas on removal ([`43c697f`](https://github.com/ivpoov/nest-aws-starter/commit/43c697fe964b8546ceec9c2b838926fb64875f1d))
- **subtraction:** fence the frontend refs for contact-us, statistic, api-key and file ([`6417c53`](https://github.com/ivpoov/nest-aws-starter/commit/6417c5387e3f91865b16f412c9962e55d188f8da))
- **subtraction:** fence the file module's half of the maintenance-jobs e2e spec ([`232ba99`](https://github.com/ivpoov/nest-aws-starter/commit/232ba99b3703b1244833aa6e5a6915528cc08bc7))
- **subtraction:** delete each module's own e2e spec and type-check the e2e suite ([`e3d094a`](https://github.com/ivpoov/nest-aws-starter/commit/e3d094a4f2aea9861f0d72f2fa9fa012d8589e02))
- **web:** stub the notification bell in the app layout spec ([`a5f352e`](https://github.com/ivpoov/nest-aws-starter/commit/a5f352e76f716521a481160a34dfe94aa9f3e631))
- **web:** cover the notification socket hook and reducer ([`2dc6e21`](https://github.com/ivpoov/nest-aws-starter/commit/2dc6e21f8d9b8f483b8838c14aafa93405f1cca9))
- **web:** cover the notification list hook ([`4180efb`](https://github.com/ivpoov/nest-aws-starter/commit/4180efb87cbe9f2d9072c0b84f648cdc7fae6188))
- **web:** cover the notification preferences hook and grid ([`8594f26`](https://github.com/ivpoov/nest-aws-starter/commit/8594f265fb25e1cda03cd2ef401de5b5afaa2fc8))
- **web:** cover the notification bell badge ([`d462f84`](https://github.com/ivpoov/nest-aws-starter/commit/d462f84b7a0fcb16d41f422bacf0b477616e8621))
- **web:** cover socket reconnect bounds and token rotation ([`7d27dd8`](https://github.com/ivpoov/nest-aws-starter/commit/7d27dd89c31ea3e6b3aa592dff10ad651305656e))

### Documentation

- **api:** correct the notification module gateway consumer note ([`3f2c976`](https://github.com/ivpoov/nest-aws-starter/commit/3f2c976b0d80e60de2981aac8ac827fe1bf86b03))
- **conventions:** codify event-subscriber fan-out and websocket transport rules ([`dcdf2bd`](https://github.com/ivpoov/nest-aws-starter/commit/dcdf2bddd74c30fac0d952221c97a708642fa782))
- **conventions:** require keyset pagination for filtered cursor lists ([`12708dc`](https://github.com/ivpoov/nest-aws-starter/commit/12708dceb3ba5cb265f2b73aae73063110728dd6))
- **removal:** regenerate the recipes from the new fence markers ([`07f672c`](https://github.com/ivpoov/nest-aws-starter/commit/07f672c2c03e01efa656c0dbaad86061b2022252))
- **removal:** scope the proof claim to what the runner actually verifies ([`e6244d9`](https://github.com/ivpoov/nest-aws-starter/commit/e6244d9a40d09892b19563e46dedc1fc47dd1f7b))
- describe the shipped feature set and notifications in the readme ([`a84df31`](https://github.com/ivpoov/nest-aws-starter/commit/a84df310a3a6803bb229b5284080a7fede3cd949))
- state the subtraction coverage caveat in the readme ([`12f9483`](https://github.com/ivpoov/nest-aws-starter/commit/12f9483b5d843eb5b4febd93b8ac5e61949dfefd))
- correct the proven-vs-documented coverage note in the removal index ([`36669c1`](https://github.com/ivpoov/nest-aws-starter/commit/36669c152cf197e8bd8f58c8da7f7055918888e8))
- document the notification email throttle and the disabled websocket transport ([`cf37d8b`](https://github.com/ivpoov/nest-aws-starter/commit/cf37d8b9ee6c462db5189bd95c512d2198d6a9a8))

### Style

- **api:** reformat the notification email service spec ([`f1bb8ce`](https://github.com/ivpoov/nest-aws-starter/commit/f1bb8ce6b6f19be78df2a63fb022109ad8a55f4b))
- **notification:** annotate the webhook error cap length explicitly ([`d63c89f`](https://github.com/ivpoov/nest-aws-starter/commit/d63c89f5a25a07938b860a1ebe2e6e3918ff0ce3))

### Chores

- **admin:** pin socket.io-client to match web and the api ([`30a61b9`](https://github.com/ivpoov/nest-aws-starter/commit/30a61b9c699d28f5566a933b27d865a82d2ddd65))
- **api:** pin socket.io and redis-adapter dependencies ([`58bd5c5`](https://github.com/ivpoov/nest-aws-starter/commit/58bd5c5e1bf86fc0675198438a427d81cc2e8118))
- **web:** pin socket.io-client to the api's version ([`4504887`](https://github.com/ivpoov/nest-aws-starter/commit/450488744c7c57af874f022155e339396db1a175))
- e2e preflight check with actionable localstack hint (#81) ([`5875c7e`](https://github.com/ivpoov/nest-aws-starter/commit/5875c7eb423bfb603a12ea702641afe7fdf6f4ec))

## v0.4.0 (2026-08-05)

[`v0.3.0...v0.4.0`](https://github.com/ivpoov/nest-aws-starter/compare/v0.3.0...v0.4.0)

### Features

- **admin:** add the Modal ui primitive ([`4c1e541`](https://github.com/ivpoov/nest-aws-starter/commit/4c1e5415953f533b2e82f9b5c18cdca8776eea06))
- **admin:** add the plans api module and hooks ([`7097011`](https://github.com/ivpoov/nest-aws-starter/commit/70970117ee8e11902c285eee2db38b9a7b6ffa21))
- **admin:** add the plans admin page with a create/edit modal ([`a6596d4`](https://github.com/ivpoov/nest-aws-starter/commit/a6596d42e595497331bad90282d3a6e4381c855d))
- **admin:** add transactions page with filters and cursor pagination ([`4b68cf4`](https://github.com/ivpoov/nest-aws-starter/commit/4b68cf4f44f243e999cf5bebec83d91634698a58))
- **admin:** add revenue KPI tiles, revenue chart, and plan breakdown ([`3d7e5fe`](https://github.com/ivpoov/nest-aws-starter/commit/3d7e5fe127333bc0fbb8aa1f495a72a58b807b6c))
- **api:** add payment data model ([`81d5de9`](https://github.com/ivpoov/nest-aws-starter/commit/81d5de97dfbcc572dd56039525647504b8125e38))
- **api:** add redis-backed distributed lock service ([`2a3ea0c`](https://github.com/ivpoov/nest-aws-starter/commit/2a3ea0c64dbdaa4b3c715b2c131774a2cf990742))
- **api:** add task-scheduler module ([`22548fb`](https://github.com/ivpoov/nest-aws-starter/commit/22548fb77fc6206e9c29982cdd9b269e854258fa))
- **api:** add subscription provider customer ref column ([`7da9ef2`](https://github.com/ivpoov/nest-aws-starter/commit/7da9ef24f9d8731ac64ab28d1e425d9cbee3b12f))
- **api:** add provider-agnostic payment core module ([`3ca6400`](https://github.com/ivpoov/nest-aws-starter/commit/3ca640041787e122febdffaf0b9f1460c36de45d))
- **api:** add stripe payment provider with checkout, portal, and webhooks ([`d9801c4`](https://github.com/ivpoov/nest-aws-starter/commit/d9801c43d539fe0c31ee4082628e6da067ef3b78))
- **api:** add webhook ingest endpoint ([`ee629c6`](https://github.com/ivpoov/nest-aws-starter/commit/ee629c6cd9969e8005151c449d6b1c8cc971853c))
- **api:** add webhook event status-transition repository methods ([`692a184`](https://github.com/ivpoov/nest-aws-starter/commit/692a184cae3504c53beeb09c31dda2f96671af16))
- **api:** add subscription lifecycle contract with temporary no-op binding ([`d6c9e79`](https://github.com/ivpoov/nest-aws-starter/commit/d6c9e795afb765c90909471a860cca071864c59b))
- **api:** add webhook event dispatcher for normalized event types ([`8c91d61`](https://github.com/ivpoov/nest-aws-starter/commit/8c91d61ba69abaf5b2325988472b4abb616f3ce4))
- **api:** add idempotent payment webhook consumer ([`e7a67c0`](https://github.com/ivpoov/nest-aws-starter/commit/e7a67c058300d55c6fd7db1759a10cb7efd58351))
- **api:** add subscription activity types to the activity log ([`1bc1b8e`](https://github.com/ivpoov/nest-aws-starter/commit/1bc1b8e74f0ff9b203db250f511153b5202e8c07))
- **api:** record activity rows for subscription lifecycle events ([`50ddbc0`](https://github.com/ivpoov/nest-aws-starter/commit/50ddbc0602abdacb0ccbd9fad4b5d29064c9523b))
- **api:** extend the subscription repository contract for lifecycle writes ([`d316e14`](https://github.com/ivpoov/nest-aws-starter/commit/d316e149cdf54304b9f12366382f59e1908a170e))
- **api:** implement subscription repository writes ([`8319031`](https://github.com/ivpoov/nest-aws-starter/commit/831903151a8ff6a8abba2c6775d1f8334fdfcf72))
- **api:** add the payment transaction repository ([`6c2f210`](https://github.com/ivpoov/nest-aws-starter/commit/6c2f2106f1c2e0e9a69c965fca3b1c6c74783f20))
- **api:** thread provider through the lifecycle contract and dispatcher ([`b513af3`](https://github.com/ivpoov/nest-aws-starter/commit/b513af3c64d2fdf8f48fbe0607997deb54ee4ad6))
- **api:** implement the subscription lifecycle service ([`d5d5618`](https://github.com/ivpoov/nest-aws-starter/commit/d5d56184a3e2a6776e9d21f33039f39aaaa596f9))
- **api:** add the subscription access check and RequiresSubscription guard ([`986abf9`](https://github.com/ivpoov/nest-aws-starter/commit/986abf9e8103f024bf25e8fb5d201728dec33cd5))
- **api:** add the hourly subscription expiry job ([`c8d3125`](https://github.com/ivpoov/nest-aws-starter/commit/c8d31253597145a8033e73376455627d4eac3cb9))
- **api:** wire the real subscription lifecycle service into the payment module ([`cd419e6`](https://github.com/ivpoov/nest-aws-starter/commit/cd419e6c73c2895eb898ae38bac7d1da6a6d6d53))
- **api:** extend the plan repository contract for admin CRUD ([`2eebca9`](https://github.com/ivpoov/nest-aws-starter/commit/2eebca9bf1e60b8571e0d9f0347921e59c086048))
- **api:** add stripe provider ref validation for plan admin ([`5deb9d4`](https://github.com/ivpoov/nest-aws-starter/commit/5deb9d493cbe9cbfbb37d0ec91910e47d90bb594))
- **api:** add plan admin entity, permissions, DTOs, and error codes ([`f587bb2`](https://github.com/ivpoov/nest-aws-starter/commit/f587bb2493d3268ee44e629314d3b12a6178b22a))
- **api:** add the plan admin service ([`bff6573`](https://github.com/ivpoov/nest-aws-starter/commit/bff6573171962743bbd103b0d8502260ee1cbba9))
- **api:** add the plan admin controller and wire it into the payment module ([`841668f`](https://github.com/ivpoov/nest-aws-starter/commit/841668ff1134ba2201a0ec92121e2dc897185d0d))
- **api:** add a dev/staging plan seed script ([`66f1c34`](https://github.com/ivpoov/nest-aws-starter/commit/66f1c3496590b88eebe724dacb15e79c3863bddd))
- **api:** add public plan response DTOs ([`3108169`](https://github.com/ivpoov/nest-aws-starter/commit/310816937465113c9df54456ca48651becea9844))
- **api:** add provider-side subscription cancellation support ([`b6b3078`](https://github.com/ivpoov/nest-aws-starter/commit/b6b30789ba9fe4bb4938ede02d0974223f890651))
- **api:** add public plan listing and cancel to the billing service ([`ef9db00`](https://github.com/ivpoov/nest-aws-starter/commit/ef9db00936513c9b732e485cfb5a22c306133333))
- **api:** add the plans and cancel billing endpoints ([`8a3eef5`](https://github.com/ivpoov/nest-aws-starter/commit/8a3eef501cb7b1acca363fa54ba0fc5f473b74ab))
- **api:** extend payment transaction repository with cursor reads ([`27a26bc`](https://github.com/ivpoov/nest-aws-starter/commit/27a26bcbbaf30f5d40ab006745d47586ae62bca5))
- **api:** add transaction service, entity, and admin permissions ([`2f06e35`](https://github.com/ivpoov/nest-aws-starter/commit/2f06e35e615dcd55dc3f01693fa71abda1c7a92f))
- **api:** add GET /billing/transactions endpoint ([`5be69ca`](https://github.com/ivpoov/nest-aws-starter/commit/5be69cadc730d91b18f2f632edd26abab321ee5e))
- **api:** add GET /admin/transactions endpoint ([`7ce3278`](https://github.com/ivpoov/nest-aws-starter/commit/7ce327884af21809de8d7ad32f529b6b7ea77989))
- **api:** add revenue TypedSQL queries ([`8b7f0ad`](https://github.com/ivpoov/nest-aws-starter/commit/8b7f0ad3104879c6cedfba6d76cb8392d58807c7))
- **api:** replace revenue stub with real revenue, mrr, and by-plan totals ([`e9d080c`](https://github.com/ivpoov/nest-aws-starter/commit/e9d080c5e0eaed2ced46598d29eb04ecaecb697d))
- **api:** add stale-pending queries to the file repository ([`c20a112`](https://github.com/ivpoov/nest-aws-starter/commit/c20a112dad8ff654a4f45786b5b0080b05075605))
- **api:** sweep orphan pending files and schedule the job ([`ff3ec51`](https://github.com/ivpoov/nest-aws-starter/commit/ff3ec5156f83776c6f92a3c7ea8652801bc66ef3))
- **api:** add retry queries to the webhook event repository ([`3d51542`](https://github.com/ivpoov/nest-aws-starter/commit/3d51542707f4fd1b0e50176aad35a39e9fdd86f2))
- **api:** add and schedule the webhook retry job ([`b63fe26`](https://github.com/ivpoov/nest-aws-starter/commit/b63fe2601c5d435ff0c9dfc2a18339e9e2ec5e2f))
- **shared:** add payment status enums ([`086adb3`](https://github.com/ivpoov/nest-aws-starter/commit/086adb32027840e000d3aa033fe0553b5b493703))
- **shared:** add payment billing wire contracts ([`115dd24`](https://github.com/ivpoov/nest-aws-starter/commit/115dd246b5d570ac7d980e0b83a7261acf101dca))
- **shared:** add plan provider ref missing error code ([`40ab3a4`](https://github.com/ivpoov/nest-aws-starter/commit/40ab3a4361228e1a9e7a4863d6d2594d40a03e15))
- **shared:** add subscription lifecycle activity types ([`515bab0`](https://github.com/ivpoov/nest-aws-starter/commit/515bab01102f800b27ece80656e4fd9fd08d5f6e))
- **shared:** add plan admin wire contracts and error codes ([`dd10ec5`](https://github.com/ivpoov/nest-aws-starter/commit/dd10ec5d31e4a8a76a8528d56ddb8f291f8e5edc))
- **shared:** add public plan wire contracts ([`54c845e`](https://github.com/ivpoov/nest-aws-starter/commit/54c845ef668351ea0098e601a2a7cd70e2c3de2a))
- **shared:** add transaction response wire interfaces ([`70c35f7`](https://github.com/ivpoov/nest-aws-starter/commit/70c35f7db0e2c97550171440adcc7c6c0f22e6ca))
- **shared:** add revenue fields and REVENUE metric to statistics contracts ([`eb77a46`](https://github.com/ivpoov/nest-aws-starter/commit/eb77a46ab96cd4d2a5f978a2562c0aed960431fc))
- **web:** add the billing api module ([`c082294`](https://github.com/ivpoov/nest-aws-starter/commit/c082294337e3bd272596fe640d86b4b26b0ddd74))
- **web:** add the billing hooks ([`40beb39`](https://github.com/ivpoov/nest-aws-starter/commit/40beb392837a40e81cd576b8e615e10f3d99c30f))
- **web:** add the pricing page ([`54747cd`](https://github.com/ivpoov/nest-aws-starter/commit/54747cd5794cdcce71616023fc86d35769d6ebf9))
- **web:** add the billing return pages ([`c569d92`](https://github.com/ivpoov/nest-aws-starter/commit/c569d9212c0225c1ada9f341879710132ecee316))
- **web:** add the billing settings page ([`ef111a1`](https://github.com/ivpoov/nest-aws-starter/commit/ef111a1c925af871b5c4581901c017709530e93c))
- **web:** wire pricing and billing routes into nav ([`08d7461`](https://github.com/ivpoov/nest-aws-starter/commit/08d746171a69321707ad8773d4bb418db837d3f8))
- add payment module to subtraction test ([`0c05714`](https://github.com/ivpoov/nest-aws-starter/commit/0c05714c7f5d20f4fd6f055ce1e27006fd91fb3a))
- add stripe module to payment subtraction group ([`6f9e5a7`](https://github.com/ivpoov/nest-aws-starter/commit/6f9e5a7986702b6cf779f84575b94d6e136568eb))
- add payment webhook queue to payment subtraction group ([`ed8937c`](https://github.com/ivpoov/nest-aws-starter/commit/ed8937c41d67df0d3fac5e3caa4c64da907dbf02))

### Bug Fixes

- **admin:** hide the revenue chart when the payment module is absent ([`df6a57a`](https://github.com/ivpoov/nest-aws-starter/commit/df6a57a75afd1c9467cdd02be4fb3b19c930d9ac))
- **api:** contain per-message errors in the webhook consumer loop ([`a2aaf03`](https://github.com/ivpoov/nest-aws-starter/commit/a2aaf03853f4eaffc14d49cb49b6e5e50432f818))
- **api:** pin tsx to the cooldown-compliant version ([`fe1dcef`](https://github.com/ivpoov/nest-aws-starter/commit/fe1dcef85fd3757beaf3ad24a36a5ffbc77aad47))
- **api:** reject metric=REVENUE with a coded 400 when payment is subtracted ([`4d3cf0a`](https://github.com/ivpoov/nest-aws-starter/commit/4d3cf0a08ac5871430edba77ea1704b67d1d96aa))
- **api:** contain per-row S3 failures in the orphan file sweep ([`153ca0e`](https://github.com/ivpoov/nest-aws-starter/commit/153ca0e3f560c34e8251aa4c110dff5a1f7beff2))
- **api:** extend subscription period on renewal replay even when the transaction already exists ([`dc3889d`](https://github.com/ivpoov/nest-aws-starter/commit/dc3889da36bd93abe46f2d62278abd39cf561fd2))
- **api:** run the stale-received webhook sweep before the failed-retry reset to avoid double-enqueue ([`b1fc82b`](https://github.com/ivpoov/nest-aws-starter/commit/b1fc82b05dd733609ea6554672d4ec4e7cf84d4d))
- **api:** pin scheduler and webhook consumer off in the e2e harness itself ([`648502a`](https://github.com/ivpoov/nest-aws-starter/commit/648502ada28998272b294d2280448b0b00a2f1ea))
- **api:** fence payment-only mocks in statistic.service.spec.ts for a clean subtraction ([`918d17e`](https://github.com/ivpoov/nest-aws-starter/commit/918d17eb022555544c04690ede2429f3aa26ea2f))
- **api:** fence payment-only content in maintenance-jobs and statistics e2e specs ([`2d3eb53`](https://github.com/ivpoov/nest-aws-starter/commit/2d3eb53e458bdd30d16588a74319e0512852e290))
- **api:** fence payment-only plan seed data so the seed entrypoint survives subtraction ([`542180a`](https://github.com/ivpoov/nest-aws-starter/commit/542180a8f01edf3d0e376b8e0ddec09df35cf12e))
- **scripts:** close the payment subtraction blast-radius gap in test/ and prisma/seed.ts ([`ba33f48`](https://github.com/ivpoov/nest-aws-starter/commit/ba33f48b6fa9381723f8b67324654b217fc3228b))
- **shared:** add PAYMENT_SUBSCRIPTION_REQUIRED to the payment error code union ([`cb9970e`](https://github.com/ivpoov/nest-aws-starter/commit/cb9970e99724b99ebe26e90d392f73c529f357eb))

### Tests

- **admin:** cover revenue KPI tiles, revenue chart, and plan breakdown ([`4bb9616`](https://github.com/ivpoov/nest-aws-starter/commit/4bb96167b751e409b07013114ba497e3b4770eae))
- **admin:** cover the revenue chart's unavailable placeholder ([`dc09a1b`](https://github.com/ivpoov/nest-aws-starter/commit/dc09a1b66d9dc2447108b9737f4bcae7aab576b2))
- **api:** tolerate aborted-before-accept in http client timeout spec ([`f0b576f`](https://github.com/ivpoov/nest-aws-starter/commit/f0b576fc9ec3986f3f64e8a51de9124ebfd8d636))
- **api:** add task-scheduler e2e coverage ([`19ec568`](https://github.com/ivpoov/nest-aws-starter/commit/19ec5680954156e3e35535f64e17a6ed6eb56f96))
- **api:** correct the scheduler e2e gate comment ([`44f1218`](https://github.com/ivpoov/nest-aws-starter/commit/44f1218309ffdae25d19e7ae45bb12dada8c60b2))
- **api:** cover the payment provider registry and billing service ([`23665e6`](https://github.com/ivpoov/nest-aws-starter/commit/23665e63958c25c0834ba77ac61a1fe37433e51b))
- **api:** add billing e2e coverage with a fake provider ([`e252ac2`](https://github.com/ivpoov/nest-aws-starter/commit/e252ac27c0d2b93c3dccaf7a1f1f106aab5b90f2))
- **api:** hold the scheduler lock across both racing instances in e2e ([`31e8b27`](https://github.com/ivpoov/nest-aws-starter/commit/31e8b27c12306d450027a55fdf4ee5fdf9629905))
- **api:** cover the stripe payment provider and event mapper ([`d78f333`](https://github.com/ivpoov/nest-aws-starter/commit/d78f33333bbbde6c3151255e3290a5c28fc9fb0e))
- **api:** cover the webhook ingest service and repository ([`d5916f9`](https://github.com/ivpoov/nest-aws-starter/commit/d5916f96147f8ec1ca30ec341f07c48b3ec4905e))
- **api:** add webhook ingest e2e coverage ([`790bc99`](https://github.com/ivpoov/nest-aws-starter/commit/790bc9985feeb5b2eb75cf9b9d3dad0daa889eb8))
- **api:** prove the webhook raw body reaches the provider byte-identical ([`7d4e893`](https://github.com/ivpoov/nest-aws-starter/commit/7d4e8937b3030b9ca82dd62c113c70bf5a18f170))
- **api:** add webhook consumer e2e coverage ([`fc7e602`](https://github.com/ivpoov/nest-aws-starter/commit/fc7e6021865cbcc595782c718a7577cf52d1b305))
- **api:** add deep subscription lifecycle e2e coverage ([`13d94ae`](https://github.com/ivpoov/nest-aws-starter/commit/13d94ae3a09e3860734bff92d9e1a2813b323213))
- **api:** add subscription access guard e2e coverage ([`b9890ef`](https://github.com/ivpoov/nest-aws-starter/commit/b9890eff9da7f89ccaf4426d760565951d3a6517))
- **api:** add plans admin e2e coverage ([`f7c6dd4`](https://github.com/ivpoov/nest-aws-starter/commit/f7c6dd47dd34f12ea6a1300f362e9c638b0e864b))
- **api:** cover public plans and cancel in billing specs ([`dadd225`](https://github.com/ivpoov/nest-aws-starter/commit/dadd2259670410ada7aa3f5d79049ac59f36496a))
- **api:** cover billing and admin transaction endpoints e2e ([`54f58a3`](https://github.com/ivpoov/nest-aws-starter/commit/54f58a310b2b68a26d6bfd62e902acbe9655ba59))
- **api:** cover revenue statistics repository, service, and cache-hit e2e ([`b4e10b0`](https://github.com/ivpoov/nest-aws-starter/commit/b4e10b0f1aa05a43615b4413e6ffe03f0eae2b18))
- **api:** prove the revenue guard and fence payment-only statistic tests ([`c1eea09`](https://github.com/ivpoov/nest-aws-starter/commit/c1eea0919a301da43fe06a93729a2fc2023e86d0))
- **api:** cover the orphan file sweep job and service ([`aed37a9`](https://github.com/ivpoov/nest-aws-starter/commit/aed37a90d203183443c6b475c4c1ef4210102c4f))
- **api:** cover the webhook retry job and service ([`86d7b80`](https://github.com/ivpoov/nest-aws-starter/commit/86d7b80d15e19496affdcde723487d46a4f5d94d))
- **api:** add end-to-end coverage for the maintenance jobs ([`dba958f`](https://github.com/ivpoov/nest-aws-starter/commit/dba958f59d1ee532b67c0e2f799e8ee842d11b67))
- **api:** prove one failing row doesn't abort the orphan file sweep ([`8a117d4`](https://github.com/ivpoov/nest-aws-starter/commit/8a117d4a0f730c6bc807f7a0da1f30840cd9ee7a))
- **web:** cover billing hooks and the success page copy ([`e9d8291`](https://github.com/ivpoov/nest-aws-starter/commit/e9d8291d133f6580010ad2f0be93f7ecb1b316f8))

### Documentation

- **api:** correct subscription.updated event scope comment ([`ae0d3e0`](https://github.com/ivpoov/nest-aws-starter/commit/ae0d3e0153261d9da2214e90fd976af740054dab))
- **api:** document the shipped orphan file sweep in the file readme ([`2f257bf`](https://github.com/ivpoov/nest-aws-starter/commit/2f257bf7b8b2e9b3f3a80c484a7bc61f9cfc4845))
- **conventions:** name P2025 and P2002 as the two permitted repository-confined Prisma error codes ([`c32cce7`](https://github.com/ivpoov/nest-aws-starter/commit/c32cce73609bd801d7cb723ad14387810b7ecb54))
- **removal:** regenerate payment removal recipe from updated fence markers ([`76711cd`](https://github.com/ivpoov/nest-aws-starter/commit/76711cdb7e7b3bd4b5f385f3ba89efff9f0f733e))
- regenerate removal recipes for the payment module ([`f7383b4`](https://github.com/ivpoov/nest-aws-starter/commit/f7383b4a6d5ccdb2c6969a13271ba3ce6c47533a))

### Style

- **api:** fix biome formatting in subscription-lifecycle spec ([`8bb0d2e`](https://github.com/ivpoov/nest-aws-starter/commit/8bb0d2e02e84e75f1e53858cdb7a1e16064fa5ed))

### Chores

- **api:** add @nestjs/schedule and cron dependencies ([`b786c1b`](https://github.com/ivpoov/nest-aws-starter/commit/b786c1b31632337ebd8a3274e2163911cc465493))
- **api:** fence revenue TypedSQL for the payment subtraction module ([`eb0ee50`](https://github.com/ivpoov/nest-aws-starter/commit/eb0ee506788ede796b47daa6550ea934badda5c8))
- **api:** regenerate payment removal doc for the revenue guard fences ([`d3fe69d`](https://github.com/ivpoov/nest-aws-starter/commit/d3fe69d766e0a5ccc96854d2fb5299ce619b06ff))
- **api:** regenerate removal docs for maintenance job line shifts ([`7054ac6`](https://github.com/ivpoov/nest-aws-starter/commit/7054ac6e1f8f3ad91ea1c4b04065028084993636))

## v0.3.0 (2026-08-04)

[`v0.2.0...v0.3.0`](https://github.com/ivpoov/nest-aws-starter/compare/v0.2.0...v0.3.0)

### Features

- **admin:** add activities api module and shared interfaces ([`d655735`](https://github.com/ivpoov/nest-aws-starter/commit/d65573586c9a8fc35d0c795ea9e2e17aac03c32d))
- **admin:** add activity list data hooks ([`590649c`](https://github.com/ivpoov/nest-aws-starter/commit/590649ccd020dc975ebac387273518c47c7dd2a8))
- **admin:** add reusable activity list and filter bar components ([`0c2c0f4`](https://github.com/ivpoov/nest-aws-starter/commit/0c2c0f4647873e8c655f93710ffd1e1625610e6a))
- **admin:** add activities page with route and nav entry ([`a9f367d`](https://github.com/ivpoov/nest-aws-starter/commit/a9f367dd982b5b18b5adcab3a61f3762ed7a3ab1))
- **admin:** add per-user activity tab to user detail drawer ([`d34188b`](https://github.com/ivpoov/nest-aws-starter/commit/d34188b31d28bced5a986e9dc1f976fa77f5d876))
- **admin:** extract activity filter state into a dedicated hook ([`c49b8a6`](https://github.com/ivpoov/nest-aws-starter/commit/c49b8a68fd266b6c2c665999faa23d53433235ed))
- **admin:** add admin user search hook ([`3a16de5`](https://github.com/ivpoov/nest-aws-starter/commit/3a16de52bd2880d4a1a43959e5ed48d417ae3858))
- **admin:** replace bare user id filter with name/email search ([`54d4945`](https://github.com/ivpoov/nest-aws-starter/commit/54d4945b5fc898e026cedb8dff757959a4671ec8))
- **admin:** add status update and login-as api calls ([`7fa0759`](https://github.com/ivpoov/nest-aws-starter/commit/7fa07596a6d2a5227cd9f4c004e2f849d45c92da))
- **admin:** add block/unblock and login-as controls to the user drawer ([`d0f3097`](https://github.com/ivpoov/nest-aws-starter/commit/d0f309707a50b45f6be77ad5b6f53480819e65fc))
- **admin:** refresh the users list after drawer status changes ([`c05f565`](https://github.com/ivpoov/nest-aws-starter/commit/c05f5659d2ea86788e9c171c4c45cc1fb110020c))
- **admin:** add an optional reason input to the block/unblock confirm step ([`801075d`](https://github.com/ivpoov/nest-aws-starter/commit/801075d47496a05b3bb0b56b64b0527840172e79))
- **admin:** add statistics api client and data hooks ([`483cf03`](https://github.com/ivpoov/nest-aws-starter/commit/483cf031bf476ca7db8daa332c100bccfa3f3ec4))
- **admin:** read theme tokens for chart colors at render time ([`f9a7c4a`](https://github.com/ivpoov/nest-aws-starter/commit/f9a7c4ae265f71a36f2554419b28a1068fab1517))
- **admin:** add statistics dashboard components ([`1b61da6`](https://github.com/ivpoov/nest-aws-starter/commit/1b61da6ad218e37b69e873c8bb87b91673b9c150))
- **admin:** wire the statistics dashboard as the default admin landing ([`95c3cbc`](https://github.com/ivpoov/nest-aws-starter/commit/95c3cbc56beb33afa8b918fcb85822a2f8cd593f))
- **admin:** add an accessible data table alongside the auth-method chart ([`97d3b04`](https://github.com/ivpoov/nest-aws-starter/commit/97d3b0410bbb6d76407e3d7bfe121c52e85a207f))
- **admin:** add contact messages api module and hooks ([`85d8d47`](https://github.com/ivpoov/nest-aws-starter/commit/85d8d47b72c75ff3f6704f3eefe7bb62554fde10))
- **admin:** add the contact status filter and message drawer ([`b103907`](https://github.com/ivpoov/nest-aws-starter/commit/b10390700541dc64f6ce6c139846f3e32d7b17b1))
- **admin:** add the inbox page and wire it into the nav ([`2a680c9`](https://github.com/ivpoov/nest-aws-starter/commit/2a680c90e14412c82280a570b0edbcef30fb9f4c))
- **api:** add activity schema and migration ([`8f1949d`](https://github.com/ivpoov/nest-aws-starter/commit/8f1949d2886ed03f9bee6a800f5ef9d1bfebbed5))
- **api:** add activity domain contract and prisma repository ([`3c484fc`](https://github.com/ivpoov/nest-aws-starter/commit/3c484fc10fc3fcbf640a21d03516fff833c4af50))
- **api:** add activity service ([`7f4f0fb`](https://github.com/ivpoov/nest-aws-starter/commit/7f4f0fb7e0946d9e1a65e1260987bc85a57b17aa))
- **api:** add activity event name constants ([`e1f697a`](https://github.com/ivpoov/nest-aws-starter/commit/e1f697a5e626c4c87318e1e0c45ee8dec301099a))
- **api:** add activity domain event subscribers ([`77600d0`](https://github.com/ivpoov/nest-aws-starter/commit/77600d023f1ebe3592612862ded925e39ef68def))
- **api:** emit user.registered on registration ([`8be848e`](https://github.com/ivpoov/nest-aws-starter/commit/8be848e0042227529efd70db1c1912079cdb7b88))
- **api:** emit auth.login on successful login ([`99e8043`](https://github.com/ivpoov/nest-aws-starter/commit/99e80437bf1315614a98470c1a13cca0fe9e81df))
- **api:** emit auth.login-failed on failed login attempts ([`19b600a`](https://github.com/ivpoov/nest-aws-starter/commit/19b600a30d04fd9039e2183e92a655e6c497632a))
- **api:** emit auth.logout on logout ([`fabe877`](https://github.com/ivpoov/nest-aws-starter/commit/fabe877711a18e4edbcf161cdfc5469393c45558))
- **api:** emit auth.password-changed on password reset ([`af8412c`](https://github.com/ivpoov/nest-aws-starter/commit/af8412cedf0a5c10ff0f27bebdda7ec0544092ee))
- **api:** emit auth.password-changed on password change ([`1b7ef32`](https://github.com/ivpoov/nest-aws-starter/commit/1b7ef32b39e55d91526c24758c00a9d9675da4cb))
- **api:** emit auth.method-linked on email method linking ([`259e08a`](https://github.com/ivpoov/nest-aws-starter/commit/259e08ab84b02ceff93604c9c889ec6fc77a27c7))
- **api:** emit auth.method-unlinked on method unlinking ([`6db579c`](https://github.com/ivpoov/nest-aws-starter/commit/6db579cbc89c36909b81d00676475466e800846e))
- **api:** emit auth.method-linked on oauth method linking ([`6ad55a8`](https://github.com/ivpoov/nest-aws-starter/commit/6ad55a83a56e3b2e555ea5c0257e5f229e880d33))
- **api:** add activity admin endpoints ([`df7df40`](https://github.com/ivpoov/nest-aws-starter/commit/df7df40d68fb657688bc0a9be223170b0ff62b9e))
- **api:** add user status update with block/unblock events ([`e5f9d1e`](https://github.com/ivpoov/nest-aws-starter/commit/e5f9d1e596bd595deaf65d1cd2987c048ea84a61))
- **api:** add admin endpoint to block and unblock users ([`c5f4fd1`](https://github.com/ivpoov/nest-aws-starter/commit/c5f4fd101b7d443468094772775857e300bb9f2a))
- **api:** record activity for user block and unblock events ([`98c165c`](https://github.com/ivpoov/nest-aws-starter/commit/98c165cade1c1e2677e94ea0981c323b1abe88b1))
- **api:** add suspicious login and new device to activity enum ([`8b09abb`](https://github.com/ivpoov/nest-aws-starter/commit/8b09abbe38bc5a322a9c8cbb356e30c936fc4fef))
- **api:** add suspicious login and new device domain events ([`3507c61`](https://github.com/ivpoov/nest-aws-starter/commit/3507c61c217be77d3fe50a15fb7bba2af12c1f9a))
- **api:** record activity for suspicious login and new device events ([`7f24853`](https://github.com/ivpoov/nest-aws-starter/commit/7f24853e1aabb49e719d806f63a5d1f07b783de6))
- **api:** add new device email alert config flag ([`f1697a8`](https://github.com/ivpoov/nest-aws-starter/commit/f1697a81885d42c66972c6229578aea042eee99c))
- **api:** add lockout redis repository contract ([`68ddc6b`](https://github.com/ivpoov/nest-aws-starter/commit/68ddc6b08bfa389ad7e639e11a99b19fc84f4a5b))
- **api:** add login lockout and new device services with listener ([`1a72155`](https://github.com/ivpoov/nest-aws-starter/commit/1a721555ad8bcdeedd94b233decccc609142c537))
- **api:** add admin lockout list and release endpoints ([`83e7eec`](https://github.com/ivpoov/nest-aws-starter/commit/83e7eecc28a7682352a408cbc584896d1123c49e))
- **api:** enforce login lockout and new device detection on login ([`4985505`](https://github.com/ivpoov/nest-aws-starter/commit/49855055a22221959bd074df71343253acef0e56))
- **api:** add signedAsAdminId session column and ADMIN_LOGIN_AS activity type ([`0a97d5d`](https://github.com/ivpoov/nest-aws-starter/commit/0a97d5d05f11cc327a427951852e360ea3ba6638))
- **api:** mint impersonated sessions with a 1h TTL in SessionService ([`13843d9`](https://github.com/ivpoov/nest-aws-starter/commit/13843d9678a258aa14591c24482b3938f332a1ca))
- **api:** add optional actAsBy claim to access tokens ([`a8be9a4`](https://github.com/ivpoov/nest-aws-starter/commit/a8be9a453f3275e794c90b26bf11e16b41d494f8))
- **api:** deny impersonated sessions on admin routes ([`c976b9f`](https://github.com/ivpoov/nest-aws-starter/commit/c976b9fd74b60b2b0e1cee04021de9cbea997ffa))
- **api:** add admin login-as endpoint ([`1dc38f6`](https://github.com/ivpoov/nest-aws-starter/commit/1dc38f6274888e6215b3da86b7d1a87ee511c2b1))
- **api:** record admin.login-as in the activity log ([`67a946c`](https://github.com/ivpoov/nest-aws-starter/commit/67a946c9878a52a5c15b5566abb9caa476739ac6))
- **api:** mint a one-time exchange code for admin login-as ([`4399bc5`](https://github.com/ivpoov/nest-aws-starter/commit/4399bc53534c0ea205829824a7d58855319cc326))
- **api:** thread an optional block/unblock reason into the activity log ([`778cf8f`](https://github.com/ivpoov/nest-aws-starter/commit/778cf8f95baf0dca9fb1e4df52cf7a3536c136a5))
- **api:** enable prisma typedSql and add statistics queries ([`ed25b55`](https://github.com/ivpoov/nest-aws-starter/commit/ed25b55a6881a2639a63365cef75ef9fcee70fb7))
- **api:** add an online-users presence gauge to the token module ([`9ccf0c1`](https://github.com/ivpoov/nest-aws-starter/commit/9ccf0c119d9455a8b0617861a41bf3853055d210))
- **api:** add the admin statistics module ([`9910dd9`](https://github.com/ivpoov/nest-aws-starter/commit/9910dd96291e7f63ce4f30be63d17cdfc0b0ecf9))
- **api:** add contact_messages table and CONTACT_RECEIVED enum value ([`eed655d`](https://github.com/ivpoov/nest-aws-starter/commit/eed655db44f150be1717f819a69ea45a9d8d3a34))
- **api:** add contact-us module contracts and permissions ([`f871b76`](https://github.com/ivpoov/nest-aws-starter/commit/f871b76bd9a3c1811384f9a3af10436622a68704))
- **api:** add contact message prisma repository ([`caf4a1a`](https://github.com/ivpoov/nest-aws-starter/commit/caf4a1a71bbb5a0e6acededad19dcfad32d6a4a7))
- **api:** add contact message service ([`4835cd8`](https://github.com/ivpoov/nest-aws-starter/commit/4835cd8e03624193064740098fa5079ddd7d610d))
- **api:** add contact-us request and response dtos ([`a1ef46d`](https://github.com/ivpoov/nest-aws-starter/commit/a1ef46de48b0d489fe6cb63b6190901fc0d044ce))
- **api:** add contact-us controllers and wire the module ([`e9d9a11`](https://github.com/ivpoov/nest-aws-starter/commit/e9d9a11dd074f80258e9ca9e2c3613d05528a8a2))
- **api:** record CONTACT_RECEIVED activity on contact.received ([`9968105`](https://github.com/ivpoov/nest-aws-starter/commit/99681053f6f92b1358b736cd67de0afbc9840ba9))
- **api:** add head-object support to the s3 provider ([`de13522`](https://github.com/ivpoov/nest-aws-starter/commit/de13522efb248342e1d1b110da8ba312024446dd))
- **api:** add cloudfront signed url provider ([`5258be2`](https://github.com/ivpoov/nest-aws-starter/commit/5258be284f3bca13a4d1af0aad9236d458f8c4ba))
- **api:** add files table and FILE_UPLOADED enum value ([`3e75787`](https://github.com/ivpoov/nest-aws-starter/commit/3e7578742b429957ef212d40d15e8b299fe4a0d5))
- **api:** add file module contracts and repository ([`b29f14d`](https://github.com/ivpoov/nest-aws-starter/commit/b29f14d6bd91b2f629ac1b4055f9c50820d430cf))
- **api:** add file service ([`1791605`](https://github.com/ivpoov/nest-aws-starter/commit/17916052786a42df367754c2ed4cca851700a12e))
- **api:** add file controllers and wire the module ([`96f9715`](https://github.com/ivpoov/nest-aws-starter/commit/96f9715243d274b963b43b7050ebb791509b99b7))
- **api:** record FILE_UPLOADED activity on file.uploaded ([`5cd7776`](https://github.com/ivpoov/nest-aws-starter/commit/5cd7776b791361166f65d682609accc44041e84d))
- **api:** add the api-key domain, repository, and service ([`00f646b`](https://github.com/ivpoov/nest-aws-starter/commit/00f646bf6b352bbb319e083c8adafac7f0db3402))
- **api:** add the api-key guard and per-key throttle guard ([`22a7e73`](https://github.com/ivpoov/nest-aws-starter/commit/22a7e73d12600c87d373c7ffca4e1278de7742db))
- **api:** add api-key admin management and demo endpoints ([`13856de`](https://github.com/ivpoov/nest-aws-starter/commit/13856deca97f942bf5b447e4e8ad8b01af8fe330))
- **api:** record api-key activity events ([`4860e21`](https://github.com/ivpoov/nest-aws-starter/commit/4860e21b674cb613b7ce2ba1f4c28cb284ea7ea4))
- **db:** add api_keys table and API_KEY_* activity types ([`3ef7491`](https://github.com/ivpoov/nest-aws-starter/commit/3ef74918f6c19d75c8955f0c96094508058e211e))
- **shared:** add activity wire contracts ([`21ecb4d`](https://github.com/ivpoov/nest-aws-starter/commit/21ecb4d3b8e15084bc410a4669b300a30f2dbcf2))
- **shared:** add update user status request contract ([`e182472`](https://github.com/ivpoov/nest-aws-starter/commit/e182472025d9ac9458da9b2ec883300af8fdc670))
- **shared:** add suspicious login and new device activity types ([`8a70511`](https://github.com/ivpoov/nest-aws-starter/commit/8a70511b96ec5ab59ee782afc46fe73a2a73fcd0))
- **shared:** add suspicious activity lockout contracts ([`9829026`](https://github.com/ivpoov/nest-aws-starter/commit/9829026a60da775a7cce8275166bab6a7b02f056))
- **shared:** add login-as wire contracts ([`8fdbb78`](https://github.com/ivpoov/nest-aws-starter/commit/8fdbb78c8909663cd2b1d3ac4968477d5e0f88e6))
- **shared:** add login-as exchange response contract ([`bf99e01`](https://github.com/ivpoov/nest-aws-starter/commit/bf99e016d0b4062b4c22da63181a6568e308356e))
- **shared:** add optional reason to the update-status wire contract ([`8f63e98`](https://github.com/ivpoov/nest-aws-starter/commit/8f63e98a8a33c8854127a91cac38ae8c9668d28e))
- **shared:** add statistics dashboard wire contracts ([`771bb22`](https://github.com/ivpoov/nest-aws-starter/commit/771bb22df624af67826072598aeb9a70106b336b))
- **shared:** add contact message wire contracts ([`3e7c03d`](https://github.com/ivpoov/nest-aws-starter/commit/3e7c03d63d27f37d425f5879c86c4691267f07e9))
- **shared:** add CONTACT_RECEIVED activity type ([`7c5a8d8`](https://github.com/ivpoov/nest-aws-starter/commit/7c5a8d861638eb2b689f8a1ce36fd0b9b1b7f227))
- **shared:** add file module wire contracts ([`304c890`](https://github.com/ivpoov/nest-aws-starter/commit/304c8904bd600c86aebb265ddcf60ad92f44efa1))
- **shared:** add FILE_UPLOADED activity type ([`575af20`](https://github.com/ivpoov/nest-aws-starter/commit/575af205d0446d5e9c3e6e82ac5f8f9bf2ad5108))
- **shared:** add api-key wire contracts ([`cafe876`](https://github.com/ivpoov/nest-aws-starter/commit/cafe8765597917bb8abb108aa2115708ea9a1873))
- **web:** add a JWT payload decoder utility ([`740b9a0`](https://github.com/ivpoov/nest-aws-starter/commit/740b9a0d149d0e92b645919cb22e552a88346be3))
- **web:** show an impersonation banner when acting as another user ([`89bb979`](https://github.com/ivpoov/nest-aws-starter/commit/89bb979499a6ba3fbf4c31fcf69a980d4a49c57c))
- **web:** flag impersonated sessions in the sessions list ([`e6a6d28`](https://github.com/ivpoov/nest-aws-starter/commit/e6a6d28ef897aff0c51b9e1b1e6c5dde000c6c9e))
- **web:** add contact api module and request contract ([`4c596a1`](https://github.com/ivpoov/nest-aws-starter/commit/4c596a1821b2666786687c3b31543affcfcbaebc))
- **web:** add textarea primitive and input maxLength support ([`fc58ff0`](https://github.com/ivpoov/nest-aws-starter/commit/fc58ff01b14d70785286019e92450affdbb9cce8))
- **web:** add the public contact page ([`c1c1ba3`](https://github.com/ivpoov/nest-aws-starter/commit/c1c1ba36ab680bed2faafdf55b4e124818b95467))
- **web:** link to the contact page from auth and app layout ([`9ab7b30`](https://github.com/ivpoov/nest-aws-starter/commit/9ab7b30c34f24371962e02b945e49fe750d3d7bc))
- **web:** add file upload constants for client-side pre-checks ([`b2c2cc7`](https://github.com/ivpoov/nest-aws-starter/commit/b2c2cc786f0cb722758d790a9eb03dedf1df89af))
- **web:** add files api module ([`097df08`](https://github.com/ivpoov/nest-aws-starter/commit/097df08be9166bc875a9705f36ba6d5a183721d1))
- **web:** add client-side file validation utilities ([`bbfdd69`](https://github.com/ivpoov/nest-aws-starter/commit/bbfdd69000eb77917c91afe862d616c6db02c6eb))
- **web:** add use file upload hook ([`944e648`](https://github.com/ivpoov/nest-aws-starter/commit/944e6483a5dd338ac39573ab873c682bbbb82477))
- **web:** add attachments demo card to the notes page ([`ea723d4`](https://github.com/ivpoov/nest-aws-starter/commit/ea723d4661f9d20b5dd9c9ebf625b65bae88a35a))
- add subtraction-test script for optional module removal ([`0f5c3fa`](https://github.com/ivpoov/nest-aws-starter/commit/0f5c3fab8f78f65c1df7a0db6996c3cc0c2a4b0b))

### Bug Fixes

- **admin:** recompute chart colors on live theme changes ([`df950a6`](https://github.com/ivpoov/nest-aws-starter/commit/df950a69a73db5fadca43d15f60f5a9b78462fad))
- **admin:** keep stale statistics data visible with an inline error on refetch failure ([`9eac49a`](https://github.com/ivpoov/nest-aws-starter/commit/9eac49ade20af6273f28d781908dd31155486685))
- **api:** 404 the nested activities endpoint for an unknown user ([`0b6257d`](https://github.com/ivpoov/nest-aws-starter/commit/0b6257ddb96e1e687abdaed708a62e820427e62c))
- **api:** catch activity write failures in domain event subscribers ([`073dccb`](https://github.com/ivpoov/nest-aws-starter/commit/073dccb9c5e02ab8f9556d1186e3850e16de39c4))
- **api:** revoke sessions before writing blocked status ([`47ccada`](https://github.com/ivpoov/nest-aws-starter/commit/47ccadac34bee88e9d90423f2a9d6a3648691604))
- **api:** honor TRUST_PROXY so request.ip reflects X-Forwarded-For ([`7ab20b6`](https://github.com/ivpoov/nest-aws-starter/commit/7ab20b6de6bbfe66020201575c75419019e0b84f))
- **api:** default the new device email flag off in env example ([`3df53fe`](https://github.com/ivpoov/nest-aws-starter/commit/3df53fe221b582b1efb509653bb8507ed17fc9c5))
- **api:** cap impersonated session refresh TTL and gate rotation on activeUntil ([`e4029b0`](https://github.com/ivpoov/nest-aws-starter/commit/e4029b00cdbf50469cb69a72c4d85ee49de1b979))
- **api:** apply impersonation denial before the ability-metadata early return ([`8503929`](https://github.com/ivpoov/nest-aws-starter/commit/8503929a0daaea89bc6f5c4adbaffa02bc60e8d8))
- **api:** make the online-users presence touch fire-and-forget ([`249bd64`](https://github.com/ivpoov/nest-aws-starter/commit/249bd647f644d8c066cac5d566a7fa3f0b7681d0))
- **api:** re-validate content type from s3 head on file confirm ([`4207360`](https://github.com/ivpoov/nest-aws-starter/commit/42073603eb2e503753cb835bd4481188159d6749))
- **api:** use conflict error for file not-uploaded and not-ready states ([`002e217`](https://github.com/ivpoov/nest-aws-starter/commit/002e2176b458d806ae3fc90ca9bd519450406f2e))
- **api:** clamp impersonated session activeUntil to an absolute 1h cap ([`6d9e38f`](https://github.com/ivpoov/nest-aws-starter/commit/6d9e38f4880f83212e56b1938d7570e29c08d69b))
- **api:** move user status orchestration into service ([`2755e0c`](https://github.com/ivpoov/nest-aws-starter/commit/2755e0cf038e4e089c6a8065ec0bfa7b8fa2e9ef))
- **ci:** provide DATABASE_URL to the build step for typedSql generation ([`fa1d2be`](https://github.com/ivpoov/nest-aws-starter/commit/fa1d2be5445898377ec592a03a48f6cc12d7ed04))
- **ci:** migrate the database before build so typedSql generation sees the schema ([`5b793c0`](https://github.com/ivpoov/nest-aws-starter/commit/5b793c0e303fd944b22528e3ef04e9b93557b98e))
- **ci:** provide database url to the test step for cached builds ([`86e836c`](https://github.com/ivpoov/nest-aws-starter/commit/86e836ceed65e516d9f93176014072aff9644dfe))
- **web:** add client-side pre-checks to avatar upload ([`df833c2`](https://github.com/ivpoov/nest-aws-starter/commit/df833c2eb500a51e28f1b6b934f3f5858c294461))
- **web:** clear stale error before starting a file download ([`80e2f21`](https://github.com/ivpoov/nest-aws-starter/commit/80e2f21958ade3bb8c5f50e9746e9b7224946a72))
- **web:** distinguish network failures from expired-presign PUT failures ([`a8acc7d`](https://github.com/ivpoov/nest-aws-starter/commit/a8acc7d910bc9886636659c021638afc67c02768))
- clean up subtraction-test worktree tmpdir on exit ([`269a263`](https://github.com/ivpoov/nest-aws-starter/commit/269a263ade10c3dff885b7f4f2fbf490ff3c178d))
- make copyGeneratedPrismaClient exception-safe and clean up worktree tmpdir on add-failure ([`6232e72`](https://github.com/ivpoov/nest-aws-starter/commit/6232e7221373e02e105ee3c26d1cfe8d2837bb9c))

### Refactoring

- **api:** extract device fingerprint parsing into shared helper ([`9d901c1`](https://github.com/ivpoov/nest-aws-starter/commit/9d901c19b2cbb81df288f69478fbd63f7e0e2059))
- **api:** extract dedicated interface for parsed lockout keys ([`1da37c7`](https://github.com/ivpoov/nest-aws-starter/commit/1da37c7568c139f99164ba19fa29f0d836004c82))
- **api:** drop the unnecessary User<->Oauth forwardRef cycle ([`c29c918`](https://github.com/ivpoov/nest-aws-starter/commit/c29c9189aab26480917039d9d065566477bc698c))
- **api:** drop unused duplicate api-key payload interfaces ([`7a17d71`](https://github.com/ivpoov/nest-aws-starter/commit/7a17d719758f37e8f61c541107254b809dcfee0a))
- **api:** fence cloudfront cross-references in file module ([`a37ea28`](https://github.com/ivpoov/nest-aws-starter/commit/a37ea28a6ea04d181582e3413a2a7c9c83cc7863))
- simplify copy-generated-client step now that it returns a status ([`78fc113`](https://github.com/ivpoov/nest-aws-starter/commit/78fc113a6d37a0e0c88649f3c1741dc735bc7388))

### CI

- add nightly subtraction-test workflow ([`ce8f076`](https://github.com/ivpoov/nest-aws-starter/commit/ce8f076187330ab9df9c5799d0c7a86b56d6d66a))

### Tests

- **admin:** cover activities hook and list component ([`a3aab89`](https://github.com/ivpoov/nest-aws-starter/commit/a3aab89a6bd8dd67cb844b23edd0ed1b90aaded4))
- **admin:** cover activity filters and user search hooks ([`a643f73`](https://github.com/ivpoov/nest-aws-starter/commit/a643f730c5dfaef0b26775345c5cbd1d5b30eab7))
- **admin:** cover the statistics hooks and dashboard page ([`eef300a`](https://github.com/ivpoov/nest-aws-starter/commit/eef300afb00f9f4dafb97117e8445caffcbd5c96))
- **admin:** cover statistics component states and the day-switcher wiring ([`7167db6`](https://github.com/ivpoov/nest-aws-starter/commit/7167db6ba13996936c381454335c05bba91b61aa))
- **admin:** cover the contact inbox hook, drawer, and page ([`c1931a4`](https://github.com/ivpoov/nest-aws-starter/commit/c1931a4b2011c25c0f1fbd8745a3c22de79c735a))
- **api:** cover activity admin endpoints e2e ([`1dc68dc`](https://github.com/ivpoov/nest-aws-starter/commit/1dc68dc8ec3b8e6f0515955e6ec5ba0c44f1cc35))
- **api:** cover user status update and activity recording ([`aa29cd6`](https://github.com/ivpoov/nest-aws-starter/commit/aa29cd671a733ff94a3fcc05c5e2d71967eb9285))
- **api:** cover admin user block and unblock e2e ([`20c3cd8`](https://github.com/ivpoov/nest-aws-starter/commit/20c3cd83ce4ffd71cdba622ecb4d759e9447a2e4))
- **api:** cover fail-safe ordering of block and revoke ([`502b990`](https://github.com/ivpoov/nest-aws-starter/commit/502b9903a28c76d34b4d7535f01923f07b9adb13))
- **api:** pin activity pagination fixture to a single login ip ([`1dbe8a3`](https://github.com/ivpoov/nest-aws-starter/commit/1dbe8a3269a7f24f6148ab5f307eb6f96c68e77c))
- **api:** cover suspicious activity lockout and new device e2e ([`640b1cb`](https://github.com/ivpoov/nest-aws-starter/commit/640b1cb3f621452921c95ecb04d0b7cddfb8ce50))
- **api:** cover admin login-as end to end ([`aa83f81`](https://github.com/ivpoov/nest-aws-starter/commit/aa83f81ac2622733eacddd80714984062750a0b7))
- **api:** exchange the login-as code through the oauth endpoint in e2e ([`19764db`](https://github.com/ivpoov/nest-aws-starter/commit/19764db71e15d6f9a32abd5bb8b6b0c60a30e877))
- **api:** assert the block/unblock reason lands in activity meta ([`ecc0fab`](https://github.com/ivpoov/nest-aws-starter/commit/ecc0fab577d8f72914348f9b0e6361faa1c668d2))
- **api:** cover the admin statistics endpoints e2e ([`6c2a4f8`](https://github.com/ivpoov/nest-aws-starter/commit/6c2a4f8f7e0457baf40dc696bdba41951e1aac58))
- **api:** cover the contact-us endpoints end to end ([`02e0934`](https://github.com/ivpoov/nest-aws-starter/commit/02e0934e854a2cb4da765eded6ac3bdb2c06c38a))
- **api:** cover the file upload flow end to end ([`f075c42`](https://github.com/ivpoov/nest-aws-starter/commit/f075c42f38dd2fe2aae7c902015a9350a0a2f1d0))
- **api:** cover the api-key guard, admin, and demo flows e2e ([`3a4a658`](https://github.com/ivpoov/nest-aws-starter/commit/3a4a658111572ffdf97fe3f63e936dd704f233ec))
- **api:** restore cloudfront-not-called assertion behind a fence ([`db6f7a9`](https://github.com/ivpoov/nest-aws-starter/commit/db6f7a97f03d54bbd541862e9b7c2d5e4ae34a4a))
- **api:** poll for activity rows in e2e to absorb listener latency ([`fbd3673`](https://github.com/ivpoov/nest-aws-starter/commit/fbd3673ed5a08d2d632e7c06ed3e55d458d1727f))
- **web:** cover the contact form ([`022624d`](https://github.com/ivpoov/nest-aws-starter/commit/022624db0b46ec6e6064e36ca28bcafe7dcb975b))
- **web:** cover the file upload hook ([`3324c4c`](https://github.com/ivpoov/nest-aws-starter/commit/3324c4c78cde10466eb4c69099b6937a86e74a2f))
- **web:** cover the attachments demo flow ([`8adee20`](https://github.com/ivpoov/nest-aws-starter/commit/8adee20354722a2b24b44feee24b3a9de7938c17))
- **web:** cover profile avatar pre-checks ([`6dbd0cd`](https://github.com/ivpoov/nest-aws-starter/commit/6dbd0cdf7d64fc26a3c9ec4ee03848702109bc5b))

### Documentation

- **script:** reword suspicious-activity non-removable rationale to accurate framing ([`e4c55cc`](https://github.com/ivpoov/nest-aws-starter/commit/e4c55ccd5d730adc68000954e927f66dc9183d5c))
- **script:** add per-provider coupling notes for deferred v0.1 providers ([`5c4a447`](https://github.com/ivpoov/nest-aws-starter/commit/5c4a4476ab381eeeaea40ba244daa5c7c2f9e167))
- generate module removal recipes from fence markers ([`eaaa487`](https://github.com/ivpoov/nest-aws-starter/commit/eaaa48704e3faef5a3b45e4e2ee04f725df6df43))
- regenerate removal recipes with per-provider notes and restored fence ([`1d5375e`](https://github.com/ivpoov/nest-aws-starter/commit/1d5375e8dce796b392c035d116e724fafd8e13bd))

### Chores

- **admin:** add recharts for the statistics dashboard ([`5d24346`](https://github.com/ivpoov/nest-aws-starter/commit/5d24346add78e90a16c9ac59f3e2694a3062bda5))
- **api:** add module fence markers to app.module.ts and configs ([`e7f8017`](https://github.com/ivpoov/nest-aws-starter/commit/e7f801763431cb61f4d266fabfd0498ca2c143b8))
- **api:** fence removable models and enums in prisma schema ([`b4f0ff9`](https://github.com/ivpoov/nest-aws-starter/commit/b4f0ff976b94c657969d77473d995d50ccff2a2a))
- gitignore .superpowers at the repo root ([`6dd7ca5`](https://github.com/ivpoov/nest-aws-starter/commit/6dd7ca593b6f8b6747e9fe5f6958b73bc34547c0))

## v0.2.0 (2026-08-03)

[`v0.1.0...v0.2.0`](https://github.com/ivpoov/nest-aws-starter/compare/v0.1.0...v0.2.0)

### Features

- **admin:** scaffold the vite react workspace ([`7e00a76`](https://github.com/ivpoov/nest-aws-starter/commit/7e00a7630a1d7c57002bd968f49fe66a0eb011c8))
- **admin:** add the api client and global stores ([`132eae4`](https://github.com/ivpoov/nest-aws-starter/commit/132eae40bd22e2f89a6de9a6af515aafb93695b8))
- **admin:** add the admin gate and layout shell ([`976d7f8`](https://github.com/ivpoov/nest-aws-starter/commit/976d7f8c41a31b75d5c5a334147f877566dbe91b))
- **admin:** add the users directory page ([`852373b`](https://github.com/ivpoov/nest-aws-starter/commit/852373ba7f663a28c4fc8063f8ffc4025126ca3d))
- **api:** user, auth method and session models ([`4335dc9`](https://github.com/ivpoov/nest-aws-starter/commit/4335dc93d4302db64cf2bec773c4316e94e1c495))
- **api:** add user repository contract and prisma implementation ([`3d272fe`](https://github.com/ivpoov/nest-aws-starter/commit/3d272fe3e0edb5b2ca42c5aeca318c13f8d30962))
- **api:** add user service ([`091523f`](https://github.com/ivpoov/nest-aws-starter/commit/091523fa72dd0c03a63f6fb9132b825f665eebfe))
- **api:** casl module with user and admin roles ([`b6cd911`](https://github.com/ivpoov/nest-aws-starter/commit/b6cd9110e9c7c0ae23cd1063a4e1f2a9d7343c59))
- **api:** add auth config and jose token service with redis allowlist ([`8e06c52`](https://github.com/ivpoov/nest-aws-starter/commit/8e06c523247a304e9f93048380d3aa4f2a326911))
- **api:** add session module with rotating refresh and grace window ([`d7d4ab0`](https://github.com/ivpoov/nest-aws-starter/commit/d7d4ab006462538c09ad540912d6a81d3032bf55))
- **api:** pass error meta through the exception envelope ([`dc8ef44`](https://github.com/ivpoov/nest-aws-starter/commit/dc8ef44e657e04fbf93801b0cf1ce34555595ba3))
- **api:** add email password auth with register login and refresh ([`4e2f551`](https://github.com/ivpoov/nest-aws-starter/commit/4e2f55129ab8a1c9b17f4a384a5b06d025219076))
- **api:** add global jwt guard with redis rate limiting ([`6c32f43`](https://github.com/ivpoov/nest-aws-starter/commit/6c32f433d1a9e3fc79cb810ec78e211ef8b3d901))
- **api:** add logout and session endpoints with public route markers ([`0209ea8`](https://github.com/ivpoov/nest-aws-starter/commit/0209ea82814e552265a32129366a595c5bb906b3))
- **api:** add one time token repository and mail templates ([`ec5990e`](https://github.com/ivpoov/nest-aws-starter/commit/ec5990eb544444fd3274e779bc9e4a76b75949c6))
- **api:** add email verification and password reset endpoints ([`4eb5bae`](https://github.com/ivpoov/nest-aws-starter/commit/4eb5bae3847d54c81b5314159bffcf5cb12c641c))
- **api:** add oauth flow core with state and one-time exchange code ([`4888d7a`](https://github.com/ivpoov/nest-aws-starter/commit/4888d7a064d67db6dd8f7d2ae3619cab76ad0a45))
- **api:** add google oauth provider ([`a808829`](https://github.com/ivpoov/nest-aws-starter/commit/a8088290b07ee01a3000834799b889b5a0210049))
- **api:** add facebook oauth provider ([`15cb3cc`](https://github.com/ivpoov/nest-aws-starter/commit/15cb3cc37cfa758f6cfedb96cc4d2fae19d502d4))
- **api:** add discord oauth provider ([`b9a18a9`](https://github.com/ivpoov/nest-aws-starter/commit/b9a18a98a7c5aaa0e8703c83f44362728684acb0))
- **api:** add http client binary download with caps ([`53ef743`](https://github.com/ivpoov/nest-aws-starter/commit/53ef74377f40f82f545f99bc8880e33002e65a90))
- **api:** add method linking endpoints with last method guard ([`81a692f`](https://github.com/ivpoov/nest-aws-starter/commit/81a692fbe883c6045d1bf5b7e4392ea01c6bc39d))
- **api:** add oauth avatar sync listener ([`6f5e876`](https://github.com/ivpoov/nest-aws-starter/commit/6f5e8763e85106893dedeb9504d9365fe4e6c49e))
- **api:** scope notes to an owner ([`5b0b16d`](https://github.com/ivpoov/nest-aws-starter/commit/5b0b16ddb41ce11aa84d2ac49c7fd0be21b0d2f4))
- **api:** enforce note ownership and casl abilities ([`8bd301c`](https://github.com/ivpoov/nest-aws-starter/commit/8bd301cd07201ecf2798bd7a6295af2e00c571e1))
- **api:** add presigned avatar upload support ([`681d93e`](https://github.com/ivpoov/nest-aws-starter/commit/681d93edc4b1393bb8fcd999b99c52905a01f1e5))
- **api:** add profile endpoints ([`af597b8`](https://github.com/ivpoov/nest-aws-starter/commit/af597b8ee0694876413b0e3ff37fd0d969db492f))
- **api:** add admin user directory and session control ([`c29f137`](https://github.com/ivpoov/nest-aws-starter/commit/c29f137dc12f3f64b8eca82e2c3191d69af73b26))
- **shared:** bootstrap contracts package with note and common wire types ([`277e14d`](https://github.com/ivpoov/nest-aws-starter/commit/277e14d9d5194437d3b7c1f3dcba360d4206860c))
- **shared:** add user wire enums and response contract ([`934b3cc`](https://github.com/ivpoov/nest-aws-starter/commit/934b3cc86d9c549d1e9dcd7915a614a8f61d0648))
- **shared:** add auth wire contracts and error meta ([`a922bd8`](https://github.com/ivpoov/nest-aws-starter/commit/a922bd8df8f6f16fde077e0683da4d8006ec241b))
- **shared:** add email flow request contracts ([`7267809`](https://github.com/ivpoov/nest-aws-starter/commit/72678095ee5039d25afd7e1e6e4f828c243ba0d7))
- **shared:** add oauth wire contracts ([`45bb7f2`](https://github.com/ivpoov/nest-aws-starter/commit/45bb7f2c1acdbab9b5b28e9479f21f34f83f904b))
- **shared:** add auth method wire contracts ([`2fbd58f`](https://github.com/ivpoov/nest-aws-starter/commit/2fbd58f8e51580999db1e86b82e78afcdcb2d621))
- **shared:** add admin user wire contracts ([`6b0fd34`](https://github.com/ivpoov/nest-aws-starter/commit/6b0fd34694257fc63728c6b185556c0aa6dfa2a3))
- **web:** scaffold the vite react workspace ([`ad97c2c`](https://github.com/ivpoov/nest-aws-starter/commit/ad97c2cc43d917c41db1554b4ce3da3843bf1b50))
- **web:** add the api client and global stores ([`84c637a`](https://github.com/ivpoov/nest-aws-starter/commit/84c637ac7305055e01aa25e8e3570f3ac93a4b0d))
- **web:** add auth pages and the oauth return flow ([`dfa812b`](https://github.com/ivpoov/nest-aws-starter/commit/dfa812b50c143c7a708994d47cf1eab675f04f0f))
- **web:** add account settings for methods, sessions and profile ([`698b074`](https://github.com/ivpoov/nest-aws-starter/commit/698b0744e0ed4e630c2b8e63d7e26222988e4174))
- **web:** add the notes playground ([`beb0a13`](https://github.com/ivpoov/nest-aws-starter/commit/beb0a1345d34f5635b26f825ce00d54984ca1126))

### Bug Fixes

- **api:** return not found atomically from note repository ([`1112684`](https://github.com/ivpoov/nest-aws-starter/commit/1112684a9d5b184ed4ec267536d0dba12917431f))
- **api:** send oauth token requests form encoded ([`cd1b995`](https://github.com/ivpoov/nest-aws-starter/commit/cd1b99587c4081318149529749c2699202b8658b))
- **api:** enable cors for the frontend origins ([`7c610c9`](https://github.com/ivpoov/nest-aws-starter/commit/7c610c9ce9580d6c087ffdbf6e15ac37c0be4fa8))
- **web:** patch react-router csrf advisory ([`2353320`](https://github.com/ivpoov/nest-aws-starter/commit/23533209c7269e3292811df9110e3fedf681d585))

### Refactoring

- **api:** implement shared wire contracts in note dtos ([`adcc1f2`](https://github.com/ivpoov/nest-aws-starter/commit/adcc1f26213261fb3f1a4bd76ae2f778c50cb799))

### CI

- pin setup-node action to v7 ([`ac8883f`](https://github.com/ivpoov/nest-aws-starter/commit/ac8883f649bddd7a0d1bbc92dee9e94a9de8dc71))
- build and test frontend workspaces ([`0d06afd`](https://github.com/ivpoov/nest-aws-starter/commit/0d06afd23034d5f1c4beaae4c08698b3413840b0))

### Tests

- **api:** cover user service and repository integration ([`982d672`](https://github.com/ivpoov/nest-aws-starter/commit/982d672618a3bc171b36963338dbca61ab5de065))
- **api:** cover auth flows and the conflict rule ([`0dd0b9c`](https://github.com/ivpoov/nest-aws-starter/commit/0dd0b9cea6283b0911511ffa7a9effa12a2cd8ce))
- **api:** cover guard enforcement instant logout and throttling ([`b50462b`](https://github.com/ivpoov/nest-aws-starter/commit/b50462b3b1e81044e1f3515508cdd9a25842c0c0))
- **api:** cover verify and reset round trips ([`db9e630`](https://github.com/ivpoov/nest-aws-starter/commit/db9e6308dc5e32eb9e6dc3cd628ce591f309e90b))
- **api:** cover the oauth login and link matrix ([`61e6520`](https://github.com/ivpoov/nest-aws-starter/commit/61e6520f3ebc687b75080156a7623aff83e9ae23))
- **api:** cover linking matrix and avatar sync ([`b6986ce`](https://github.com/ivpoov/nest-aws-starter/commit/b6986ce11f3bbafab9f01193f1be109fdf0bfedd))
- **api:** provision the s3 bucket before avatar sync e2e ([`143df86`](https://github.com/ivpoov/nest-aws-starter/commit/143df860e698cdad5714221b32da6c50722cb312))
- **api:** cover the note ownership matrix ([`acf29e6`](https://github.com/ivpoov/nest-aws-starter/commit/acf29e6d96c6c21fdb2c8e243d157ab297d301d4))
- **api:** cover the profile round-trip ([`4094347`](https://github.com/ivpoov/nest-aws-starter/commit/409434757784f340a786f1c5ad72fd1335518efd))
- **api:** cover the admin user matrix ([`58f6dd9`](https://github.com/ivpoov/nest-aws-starter/commit/58f6dd91896fd1a7c1e29cd66447f31515d04171))

### Documentation

- add local development setup to readme ([`7896b4a`](https://github.com/ivpoov/nest-aws-starter/commit/7896b4affd70fb0f349b44e43e577e99063619bb))
- document cache null and backfill ttl semantics ([`455ea56`](https://github.com/ivpoov/nest-aws-starter/commit/455ea569e7f5ada38e799942c1a32bd2abeb66ef))
- align controller samples with the shipped note module ([`d0e4ca9`](https://github.com/ivpoov/nest-aws-starter/commit/d0e4ca9ce42fe3a8738269e7b620f374b992c70a))

### Chores

- adopt typescript 7 native compiler ([`31bb394`](https://github.com/ivpoov/nest-aws-starter/commit/31bb394e911ba0f6d7e8adb34d2a4e079a052a21))
- upgrade ioredis to v6 ([`df29d28`](https://github.com/ivpoov/nest-aws-starter/commit/df29d2807ba4c348a892eea12766e4bb28eabe7b))

## v0.1.0 (2026-08-02)

### Features

- **api:** scaffold nestjs application ([`7a2453a`](https://github.com/ivpoov/nest-aws-starter/commit/7a2453a5b6db2675afef6934ffa7fa11aa5e0115))
- **api:** add zod-validated config system ([`ac823d7`](https://github.com/ivpoov/nest-aws-starter/commit/ac823d7f521d0a9353b8e7ebd5d7ba8023132533))
- **api:** add structured json logger with request correlation ([`503f7c7`](https://github.com/ivpoov/nest-aws-starter/commit/503f7c711f68b3cf3d1e318d36e23dc2a1ac244c))
- **api:** add versioning, validation, gated swagger and graceful shutdown ([`b9961b9`](https://github.com/ivpoov/nest-aws-starter/commit/b9961b97fe3701888224c26dfde06b99935d1a52))
- **api:** integrate prisma with global prisma module ([`135609b`](https://github.com/ivpoov/nest-aws-starter/commit/135609b99fd6eeadd907d9f7232a8d415cc4da14))
- **api:** add health module with liveness and readiness probes ([`1821185`](https://github.com/ivpoov/nest-aws-starter/commit/18211852fce2e5f04fcac84efd0f936b75c8b954))
- **api:** add redis provider with single and cluster modes ([`18cc596`](https://github.com/ivpoov/nest-aws-starter/commit/18cc59626249a7c72870563b0f628de8e6620d88))
- **api:** add tiered cache service with memory and redis stores ([`56fa583`](https://github.com/ivpoov/nest-aws-starter/commit/56fa583cb9f68552da0cda6eabe02c79f7c6cd59))
- **api:** add transport-agnostic coded errors and global exception filter ([`93ff0a7`](https://github.com/ivpoov/nest-aws-starter/commit/93ff0a76a853b2ac15ffec536206c2421a4a173c))
- **api:** add response serialization and swagger response decorators ([`5f2f62b`](https://github.com/ivpoov/nest-aws-starter/commit/5f2f62bd7512168c5fa35910d01917c0069c0b9d))
- **api:** add internal event bus ([`d6045bc`](https://github.com/ivpoov/nest-aws-starter/commit/d6045bc1658dbc61ec48d9b61fa70b54460f4c36))
- **api:** add s3 provider with presigned urls ([`5c498b1`](https://github.com/ivpoov/nest-aws-starter/commit/5c498b186c559faff87a7c0d3d8ba89c19a9dc4f))
- **api:** add sqs provider ([`7917a43`](https://github.com/ivpoov/nest-aws-starter/commit/7917a43c65d7cd869ec98ce74e38859e375c1122))
- **api:** add sns provider ([`edb574c`](https://github.com/ivpoov/nest-aws-starter/commit/edb574ce0380f663330b5d817ac6a4540980a561))
- **api:** add ses mail transport behind transport abstraction ([`ee78f5b`](https://github.com/ivpoov/nest-aws-starter/commit/ee78f5b7afb7fe8f8fb64f581683e0d962f5e573))
- **api:** add lambda invoker with example function ([`763623f`](https://github.com/ivpoov/nest-aws-starter/commit/763623f5c7e2adba3e5931977f42f521d39f2996))
- **api:** add http client with timeouts and retries ([`a231019`](https://github.com/ivpoov/nest-aws-starter/commit/a231019b14598126b6f5ff7d0cc302f6c7960b35))
- **api:** add note model and migration ([`06683ad`](https://github.com/ivpoov/nest-aws-starter/commit/06683ad72f9fa459b37e0ae28312c63fc94a6c14))
- **api:** add note repository contract and service ([`6bbe5a4`](https://github.com/ivpoov/nest-aws-starter/commit/6bbe5a43670136a2f7259973b43e7615df1141b7))
- **api:** add note controller with crud endpoints ([`5149e91`](https://github.com/ivpoov/nest-aws-starter/commit/5149e910de44a9d4820b643ec6ede648c3db3e65))

### Bug Fixes

- **api:** tolerate missing database url in prisma config ([`2e1944e`](https://github.com/ivpoov/nest-aws-starter/commit/2e1944eee84994b00e87f7b8a9d425ea5bed29d9))
- patch find-my-way and fastify static high severity advisories ([`3c3f3f4`](https://github.com/ivpoov/nest-aws-starter/commit/3c3f3f4d5454810fa94c5906c6cdb887e959abbc))

### CI

- add github actions pipeline with lint test and audit ([`340419b`](https://github.com/ivpoov/nest-aws-starter/commit/340419b7f46b30b3e8b5129d8631fc09bb8e2f5e))
- add docker compose and e2e tests to pipeline ([`1bc5a10`](https://github.com/ivpoov/nest-aws-starter/commit/1bc5a10fb06105e30bb5b5c279d163939bba1eb2))

### Documentation

- add backend conventions and claude guidance ([`ebd6be7`](https://github.com/ivpoov/nest-aws-starter/commit/ebd6be76503fe0b81a283b97feb699ca92569443))
- align error conventions with transport-agnostic string codes ([`2c08f24`](https://github.com/ivpoov/nest-aws-starter/commit/2c08f24ca625895938ea38ce8a5defc599d25788))

### Chores

- scaffold pnpm workspaces monorepo with turborepo ([`ad0bdd4`](https://github.com/ivpoov/nest-aws-starter/commit/ad0bdd48ca49ed180c533ac60246f31d0f4c3c29))
- add biome lint and format configuration ([`8522915`](https://github.com/ivpoov/nest-aws-starter/commit/85229151ecb6933e22bdaad66e42a5e9aaeec8b6))
- enforce conventional commits with husky and commitlint ([`84b1330`](https://github.com/ivpoov/nest-aws-starter/commit/84b1330c2df77a1ca64fe2cb5556b72f47ed6252))
- add renovate with 30-day minimum release age ([`9b8b85b`](https://github.com/ivpoov/nest-aws-starter/commit/9b8b85be01bc874a88f8abdd42edc463f7b8663b))
- add docker compose with postgres ([`6f24b41`](https://github.com/ivpoov/nest-aws-starter/commit/6f24b41300416700b61936e725f76214bb2a4c3d))
- enable parameter decorators and vcs ignores in biome ([`663d122`](https://github.com/ivpoov/nest-aws-starter/commit/663d12295268a55c8b2734cd8247ef8777b5eefa))
- pass database url env to turbo e2e task ([`9f78cd1`](https://github.com/ivpoov/nest-aws-starter/commit/9f78cd1e6c06a7417fe773e6f903fc3024692ab2))
- add redis to docker compose with cluster profile ([`e9f0398`](https://github.com/ivpoov/nest-aws-starter/commit/e9f0398de14b61e3c86764dbbf0f53130888dac4))
- add localstack and minio to docker compose ([`5505723`](https://github.com/ivpoov/nest-aws-starter/commit/550572330732413c564ce4a492b1b59c4e1785b3))
- gate minio init behind compose profile ([`f717b16`](https://github.com/ivpoov/nest-aws-starter/commit/f717b16e5c5d9dc53586eda796db5facfc484076))
- pin localstack image to stable major ([`275e40d`](https://github.com/ivpoov/nest-aws-starter/commit/275e40d27450adcd065cba52ae951ddcfe6465ca))
