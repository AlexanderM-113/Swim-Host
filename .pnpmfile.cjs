// Safety net for installs after the pnpm "catalog:" feature was removed from
// this workspace. If any package.json still references "catalog:" (e.g. a stale
// branch or a transitive workspace package), normalize it to "*" so installs
// don't hard-fail looking for a catalog that no longer exists.
const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

function normalizeCatalogSpecs(pkg) {
  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      const spec = deps[name];
      if (typeof spec === "string" && spec.startsWith("catalog:")) {
        deps[name] = "*";
      }
    }
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage(pkg) {
      return normalizeCatalogSpecs(pkg);
    },
  },
};
