# AIOx TODO

This file tracks remaining release work for the `@fcaldas1/aiox` npm package.

## Completed package-readiness work

- [x] Remove `private: true` from `package.json`
- [x] Add publish metadata to `package.json`
- [x] Add `src/index.js`
- [x] Export the public API from the package root
- [x] Add runtime selection for `claude`, `codex`, and `both`
- [x] Add hard prerequisite checks for external GStack and GSD installs
- [x] Update the README with installation and API instructions
- [x] Run `npm pack` and inspect the tarball contents
- [x] Verify the final `bin` entry against the packed artifact
- [x] Publish `@fcaldas1/aiox@0.1.0` to npm with `npm publish --access public`

## Remaining public GitHub steps

- [ ] Commit the package source, tests, and generated `dist/` files
- [ ] Push to GitHub
- [ ] Tag the release after the GitHub commit lands
- [ ] Publish a patch release if README changes need to appear on npm

## Usage goal

The target outcome is that a user can install the package with:

```bash
npm install @fcaldas1/aiox
```

and then run:

```bash
npx @fcaldas1/aiox init --runtime codex
```

## Notes

- AIOx must not install GSD or GStack; it only validates them and reports exact missing prerequisites.
- Use the personal scoped package name because npm rejected the unscoped `aiox` name as too similar to existing packages and the `@tabario` scope is not available to this account.
