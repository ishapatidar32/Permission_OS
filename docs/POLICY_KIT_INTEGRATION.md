# Connect the standalone `mcp-policy-kit` repository

The policy engine source is intentionally not stored in this PermissionOS repository anymore. The standalone source is supplied in the separate `mcp-policy-kit.zip` archive.

## 1. Create and push the new repository
1. Extract `mcp-policy-kit.zip` into a folder named `mcp-policy-kit`.
2. Create a new **public** GitHub repository named `mcp-policy-kit` (do not add a README/license in GitHub, because the zip already contains them).
3. From inside the extracted folder run:

```bash
git init
git add .
git commit -m "Initial release of mcp-policy-kit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mcp-policy-kit.git
git push -u origin main
git tag v0.1.0
git push origin v0.1.0
```

## 2. Connect it to PermissionOS
In the PermissionOS root `package.json`, replace:

```json
"mcp-policy-kit": "git+https://github.com/REPLACE_WITH_GITHUB_USERNAME/mcp-policy-kit.git#v0.1.0"
```

with your real GitHub username/organization. Then run from the PermissionOS root:

```bash
npm install
```

The gateway and tests import the package by its package name (`mcp-policy-kit`), so application code does not need relative paths into the kit repository. Keep `mcp-policy-kit` source changes in the new repository; consume them in PermissionOS by tagging a new version and updating the Git dependency tag.

## 3. Run the app

```bash
npm run db:seed
npm run dev:all
```

Open http://localhost:5173. Run `npm test` in another terminal for the PermissionOS tests.

## Notes
- This archive is a starter package/repository, not a published npm package.
- The root dependency is deliberately a placeholder until the GitHub repo exists. `npm install` will fail before you replace that placeholder with the real repository URL.
- If the repository is private, npm/Git must have credentials to clone it.
