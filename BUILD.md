To build a rendered version of the spec from a local copy of the repository, do this from within your repository's directory:

One-time setup to install the tools:

* `npm install`

To render, use the build script in `package.json`:

* `npm run build`

The result will be in `out/index.html` (which is prevented from creeping into commits via a `.gitignore` rule).
