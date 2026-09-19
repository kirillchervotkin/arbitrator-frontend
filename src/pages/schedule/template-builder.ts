import type { TemplateSchema, Format } from "../../types/schedule";
export function buildTemplate(
  name: string,
  cityId: string,
  format: Format | "GROUP_PLAYOFF",
  count: number,
  rounds: number,
  intervalDays: number,
): TemplateSchema {
  if (!Number.isInteger(count) || count < 2 || count > 128)
    throw new Error("Количество команд: от 2 до 128");
  const slots = (n: number, prefix: string) =>
    Array.from({ length: n }, (_, i) => ({
      name: `${prefix}${i + 1}`,
      seed: i + 1,
    }));
  if (format === "GROUP_PLAYOFF") {
    if (count < 4 || count % 2)
      throw new Error(
        "Для двух равных групп нужно чётное число команд, не меньше четырёх",
      );
    return {
      name,
      type: "CUP",
      cityId,
      intervalDays,
      stages: [
        ...["A", "B"].map((key) => ({
          key,
          name: `Группа ${key}`,
          type: "GROUP" as const,
          format: "ROUND_ROBIN" as const,
          slots: slots(count / 2, key),
          settings: {
            rounds,
            pointsForWin: 3,
            pointsForDraw: 1,
            pointsForLoss: 0,
            tieBreakers: ["headToHead", "goalDifference", "goalsScored"] as (
              | "headToHead"
              | "goalDifference"
              | "goalsScored"
            )[],
          },
        })),
        {
          key: "playoff",
          name: "Плей-офф",
          type: "PLAYOFF",
          format: "SINGLE_ELIM",
          slots: [
            { name: "A1", seed: 1 },
            { name: "B2", seed: 4 },
            { name: "B1", seed: 2 },
            { name: "A2", seed: 3 },
          ],
          settings: {
            legsPerRound: 1,
            qualification: ["A1", "B2", "B1", "A2"].map((slotName) => ({
              slotName,
              sourceType: "GROUP",
              sourceStageKey: slotName[0],
              sourcePosition: Number(slotName[1]),
            })),
          },
        },
      ],
    };
  }
  return {
    name,
    type: format === "ROUND_ROBIN" ? "LEAGUE" : "CUP",
    cityId,
    intervalDays,
    stages: [
      {
        key: "main",
        name: format === "ROUND_ROBIN" ? "Основной этап" : "Плей-офф",
        type: format === "ROUND_ROBIN" ? "STAGE" : "PLAYOFF",
        format,
        slots: slots(count, "Участник "),
        settings:
          format === "ROUND_ROBIN"
            ? {
                rounds,
                pointsForWin: 3,
                pointsForDraw: 1,
                pointsForLoss: 0,
                tieBreakers: ["headToHead", "goalDifference", "goalsScored"],
              }
            : {
                legsPerRound: 1,
                ...(format === "DOUBLE_ELIM"
                  ? { grandFinalReset: true, dropToLowerBracket: true }
                  : {}),
              },
      },
    ],
  };
}
