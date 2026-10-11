# Contribution Guidelines

### Issue

 1. Try the latest version from the default branch, perhaps the problem has been solved.
 2. Search the existing issues, maybe there is already an answer.
 3. If not found, create an issue. Please carefully describe how to reproduce it and pay attention to the issue template. If possible, provide a minimal example, e.g. on [JSFiddle](https://jsfiddle.net/).

***

### Pull Request

 1. Before a pull request run `pnpm lint`, `pnpm typecheck` and `pnpm test`.
 2. Please take care about basic commit message conventions, see [Writing Good Commit Messages](https://github.com/erlang/otp/wiki/writing-good-commit-messages).
 3. Pull requests only into the default branch.

***

### Setup

This project requires [Node.js](https://nodejs.org/en/) and [pnpm](https://pnpm.io/).

 1. Fork the repository.
 2. Clone locally.
 3. From your local repo run `pnpm install`.
 4. Install the browser for tests once with `pnpm exec playwright install chromium`.
 5. Run the local dev server with `pnpm dev` and go to `http://localhost:5173/`.
