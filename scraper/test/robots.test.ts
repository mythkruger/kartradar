import assert from "node:assert/strict";
import { test } from "node:test";
import { isDisallowed } from "../src/core/robots.js";

test("robots.txt: * grubu, en uzun kural kazanır, başka botların kuralı bizi bağlamaz", () => {
  const txt = `User-agent: Googlebot\nDisallow: /kampanyalar\n\nUser-agent: *\nDisallow: /admin/\nDisallow: /kampanyalar/arsiv\nAllow: /kampanyalar/arsiv/acik\n`;
  assert.equal(isDisallowed(txt, "/kampanyalar"), false);
  assert.equal(isDisallowed(txt, "/admin/x"), true);
  assert.equal(isDisallowed(txt, "/kampanyalar/arsiv/eski"), true);
  assert.equal(isDisallowed(txt, "/kampanyalar/arsiv/acik/1"), false);
  assert.equal(isDisallowed("User-agent: *\nDisallow: /\n", "/kampanyalar"), true);
  assert.equal(isDisallowed("User-agent: *\nDisallow:\n", "/kampanyalar"), false);
  assert.equal(isDisallowed("User-agent: *\nDisallow: /*.json$\n", "/a/b.json"), true);
});
