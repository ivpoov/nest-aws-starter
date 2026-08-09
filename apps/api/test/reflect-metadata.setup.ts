// The decorator metadata polyfill both suites need. main.ts imports it as its
// very first line, but neither suite goes through main.ts — apps/api/test/
// app.factory.ts builds the app itself, and unit specs instantiate providers
// directly. Until this file existed, the polyfill only arrived as a side
// effect of @nestjs/common importing it for its own use: an undeclared
// dependency that would break the day Nest stopped needing it, in a way that
// looks like a decorator bug rather than a missing import. Declaring it here
// makes the test bootstrap say what it depends on, the same way main.ts does.
import 'reflect-metadata';
