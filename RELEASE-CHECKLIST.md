# Release Checklist for @plust/datasleuth

This checklist should be completed before each new release to ensure quality and consistency.

## Pre-Release Tasks

### Code Preparation

- [ ] All feature branches have been merged to `main` for this release
- [ ] All known bugs for this release milestone have been fixed
- [ ] Code follows the project's style guidelines (run `npm run lint` and `npm run format`)
- [ ] All tests pass (run `npm run test:console`)
- [ ] Test coverage meets or exceeds previous release (run `npm run test:coverage`)
- [ ] All examples work as expected (run each example script)

### Documentation

- [ ] API documentation is up to date with all new features and changes
- [ ] README.md is updated with any new features, usage examples, or requirement changes
- [ ] CHANGELOG.md is updated with all notable changes for this version
- [ ] Documentation has been reviewed for clarity and completeness
- [ ] TypeDoc API documentation has been generated successfully (`npm run docs`)

### Version Management

- [ ] Version number in package.json follows Semantic Versioning
  - Major version: incompatible API changes
  - Minor version: backward-compatible functionality additions
  - Patch version: backward-compatible bug fixes
- [ ] Dependencies have been reviewed and updated if necessary
- [ ] package-lock.json or yarn.lock is up to date with the latest dependencies

## Release Process

### Final Validation

- [ ] Run `npm run validate` to ensure linting, tests, and build all succeed
- [ ] Run `npm run release:dry` to check the package contents without publishing
- [ ] Review the package contents to ensure all necessary files are included and no unintended files are included

### Release

- [ ] Update version in package.json
- [ ] Commit version change with message "Release v{version}"
- [ ] Create a Git tag for the release: `git tag v{version}`
- [ ] Push the tag to GitHub: `git push origin v{version}`
- [ ] Run the release command: `npm run release`
- [ ] Verify the package is live on npm: `npm view @plust/datasleuth version`

### Post-Release

- [ ] Create a GitHub Release with release notes
- [ ] Announce the release in appropriate channels
- [ ] Start planning for the next release cycle

## Hotfix Process

If an urgent bug fix is needed for a released version:

1. Create a hotfix branch from the released tag
2. Make the necessary fixes
3. Update the patch version (e.g., 1.0.0 → 1.0.1)
4. Update CHANGELOG.md with the bug fix details
5. Follow the regular Release Process steps above

## Additional Checks for Major Releases

- [ ] All deprecated features have been removed as announced in previous releases
- [ ] Migration guide has been created for users updating from the previous major version
- [ ] Breaking changes are clearly documented in CHANGELOG.md and README.md
- [ ] Backward compatibility layers have been considered where appropriate