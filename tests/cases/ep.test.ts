import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { epFromWhite } from "../../src/lib/analysis/ep.ts";

describe("epFromWhite", () => {
  it("is 0.5 at cp 0", () => {
    assert.equal(epFromWhite(0, null), 0.5);
  });

  it("approaches 1 for large white advantage", () => {
    assert.ok(epFromWhite(1000, null) > 0.97);
  });

  it("approaches 0 for large black advantage", () => {
    assert.ok(epFromWhite(-1000, null) < 0.03);
  });

  it("is decisive on mate scores", () => {
    assert.equal(epFromWhite(null, 3), 1);
    assert.equal(epFromWhite(900, -1), 0);
  });

  it("rises monotonically with cp", () => {
    assert.ok(epFromWhite(100, null) > epFromWhite(0, null));
    assert.ok(epFromWhite(0, null) > epFromWhite(-100, null));
  });
});
