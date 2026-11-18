# Repository Guidelines

## Project Structure & Module Organization

This repository is currently an empty Git repository. No application code, tests, assets, or build configuration have been committed. When adding the initial implementation, group source code, tests, and static assets into clearly named directories, and document their actual locations here. Keep generated files and local configuration out of version control.

## Build, Test, and Development Commands

No installation, development, build, lint, or test commands are configured yet. Do not assume a particular language, package manager, or framework. When introducing tooling, record the exact commands in this guide and the project README, including required runtime versions and setup steps. Prefer commands that work from the repository root.

## Coding Style & Naming Conventions

No coding conventions or formatter settings exist yet. Follow the conventions of the language selected for the first implementation, use consistent indentation, and choose descriptive filenames and identifiers. Add formatter or lint configuration alongside the code that needs it; reuse that configuration for subsequent contributions.

## Testing Guidelines

No testing framework or coverage threshold is configured. Include focused tests for new behavior and bug fixes once executable code is introduced. Use the chosen framework's standard test naming and placement conventions, and document how contributors can run the suite.

## Commit & Pull Request Guidelines

There is no commit history from which to infer a message convention. Use short, imperative commit subjects that describe the change, such as `Add initial application setup`. Keep commits focused.

Pull requests should explain the purpose, summarize changes, link relevant issues, and describe validation performed. Include screenshots for visible interface changes. State explicitly when checks could not be run.

## Security & Configuration

Never commit secrets, credentials, or private configuration. Provide placeholder configuration examples when setup requires environment variables, and ignore local secret files before adding them.
