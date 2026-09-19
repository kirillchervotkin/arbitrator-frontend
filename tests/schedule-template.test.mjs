import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTemplate } from "../src/pages/schedule/template-builder.ts";
for (const format of ["ROUND_ROBIN", "SINGLE_ELIM", "DOUBLE_ELIM"]) {
  test(`${format}: шаблон до жеребьёвки сохраняет состав и посев`, () => {
    for (const count of [2, 3, 4, 8, 128]) {
      const schema = buildTemplate(
        "Тест",
        "550e8400-e29b-41d4-a716-446655440000",
        format,
        count,
        2,
        3,
      );
      assert.equal(schema.cityId, "550e8400-e29b-41d4-a716-446655440000");
      assert.equal(schema.stages[0].slots.length, count);
      assert.equal(
        new Set(schema.stages[0].slots.map((s) => s.seed)).size,
        count,
      );
      assert(schema.stages[0].slots.every((s) => !s.teamId));
      assert.equal(schema.stages[0].format, format);
    }
  });
}
test("группы: квалификация ссылается на существующие группы и уникальные слоты", () => {
  const schema = buildTemplate("Кубок", "550e8400-e29b-41d4-a716-446655440000", "GROUP_PLAYOFF", 8, 1, 2);
  const groups = schema.stages.filter((s) => s.type === "GROUP");
  const playoff = schema.stages.find((s) => s.type === "PLAYOFF");
  assert.equal(
    groups.reduce((sum, g) => sum + g.slots.length, 0),
    8,
  );
  for (const rule of playoff.settings.qualification) {
    assert(groups.some((g) => g.key === rule.sourceStageKey));
    assert(playoff.slots.some((s) => s.name === rule.slotName));
    assert([1, 2].includes(rule.sourcePosition));
  }
  assert.equal(
    new Set(playoff.settings.qualification.map((r) => r.slotName)).size,
    4,
  );
});
test("недопустимый состав не создаёт частично валидный шаблон", () => {
  for (const count of [0, 1, 129, 2.5])
    assert.throws(() => buildTemplate("Тест", "1", "ROUND_ROBIN", count, 1, 1));
  for (const count of [2, 3, 5])
    assert.throws(() =>
      buildTemplate("Тест", "1", "GROUP_PLAYOFF", count, 1, 1),
    );
});
