# Changelog

All notable changes to the @plust/datasleuth package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-05-12

### Added
- Initial release of @plust/datasleuth
- Core research API with modular pipeline architecture
- Schema validation with Zod
- Integration with Vercel AI SDK for multiple LLM providers
- Basic research steps: plan, searchWeb, extractContent
- Analysis steps: analyze, factCheck, summarize, classify
- Flow control steps: evaluate, repeatUntil
- Advanced features: track, parallel, orchestrate, refineQuery
- Result merging utilities with conflict resolution strategies
- Exponential backoff retry mechanism
- Comprehensive error handling
- Extensive documentation and usage examples

## [0.9.0] - 2025-05-01

### Added
- Beta release for internal testing
- Implementation of all core features
- Integration with search providers through @plust/search-sdk
- Test coverage for all components
- Initial API documentation

### Changed
- Improved error handling with specific error types
- Enhanced performance for parallel research
- Optimized memory usage for large research operations

## [0.8.0] - 2025-04-15

### Added
- Alpha release for limited partners
- Implementation of basic and analysis steps
- Integration with OpenAI models
- Initial test coverage

### Known Issues
- Performance limitations with parallel research
- Memory usage concerns with large datasets
- Limited error handling for edge cases