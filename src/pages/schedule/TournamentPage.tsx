import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Tab,
  TableCell,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { scheduleApi } from "../../services/schedule";
import type {
  Stage,
  Format,
  StageType,
  Settings,
  Match,
  TeamSlot,
  BracketSlot,
} from "../../types/schedule";
import {
  DataTable,
  Editor,
  QueryState,
  dateRange,
  displayDate,
  download,
  formats,
  integer,
  localDate,
  options,
  stageTypes,
  tournamentFields,
  tournamentTypes,
} from "./shared";
import type { EditorConfig, Field, Values } from "./shared";

export default function TournamentPage() {
  const { id = "" } = useParams();
  const client = useQueryClient(),
    navigate = useNavigate();
  const [tab, setTab] = useState(0),
    [selected, setSelected] = useState(""),
    [status, setStatus] = useState("all"),
    [editor, setEditor] = useState<EditorConfig | null>(null),
    [message, setMessage] = useState("");
  const data = useQuery({
    queryKey: ["schedule", "calendar", id],
    queryFn: () => scheduleApi.calendar(id),
    enabled: !!id,
  });
  const teams = useQuery({
    queryKey: ["schedule", "teams"],
    queryFn: scheduleApi.teams,
  });
  const cities = useQuery({
    queryKey: ["schedule", "cities"],
    queryFn: scheduleApi.cities,
  });
  const c = data.data;
  const stage =
    c?.stages.find((s) => s.id === selected) ??
    c?.stages.find(
      (s) => !c.stages.some((child) => child.parentStageId === s.id),
    ) ??
    c?.stages[0];
  const table = useQuery({
    queryKey: ["schedule", "standings", stage?.id],
    queryFn: () => scheduleApi.standings(stage!.id),
    enabled: tab === 3 && stage?.format === "ROUND_ROBIN",
  });
  const teamName = (teamId: string | null) =>
    teams.data?.find((t) => String(t.id) === teamId)?.name ??
    (teamId ? `Команда ${teamId}` : "Команда не назначена");
  const cityName = (cityId: string) =>
    cities.data?.find((t) => String(t.id) === cityId)?.name ??
    `Город ${cityId}`;
  const participant = (m: Match, side: "home" | "away") =>
    m[`${side}TeamId`]
      ? teamName(m[`${side}TeamId`])
      : (c?.slots.find((s) => s.id === m[`${side}SlotId`])?.slotName ??
        "Ожидает участника");
  const refresh = () => {
    client.invalidateQueries({ queryKey: ["schedule"] });
  };
  const saved = () => {
    refresh();
    setMessage("Изменения сохранены");
  };
  const confirm = (
    title: string,
    description: string,
    submit: () => Promise<unknown>,
    danger = false,
  ) =>
    setEditor({
      title,
      description,
      fields: [],
      submit,
      danger,
      submitLabel: danger ? "Удалить" : "Выполнить",
    });
  const stageOptions = (c?.stages ?? []).map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const teamOptions = (teams.data ?? []).map((t) => ({
    value: String(t.id),
    label: t.name,
  }));
  const cityOptions = (cities.data ?? []).map((t) => ({
    value: String(t.id),
    label: t.name,
  }));
  const stripSettings = (s: Settings | null): Settings => {
    const copy = { ...s };
    delete copy.generated;
    return copy;
  };
  const stageEditor = (s?: Stage) => {
    const settings = s?.settings ?? {};
    const generated = !!settings.generated;
    const fields: Field[] = [
      { name: "name", label: "Название этапа", required: true },
      {
        name: "sortOrder",
        label: "Порядок",
        type: "number",
        min: 0,
        required: true,
      },
    ];
    if (!generated)
      fields.push(
        {
          name: "parentStageId",
          label: "Родительский этап",
          options: stageOptions.filter((o) => o.value !== s?.id),
        },
        {
          name: "type",
          label: "Тип этапа",
          required: true,
          options: options(stageTypes),
        },
        {
          name: "format",
          label: "Формат",
          required: true,
          options: options(formats),
        },
        {
          name: "rounds",
          label: "Количество кругов",
          type: "number",
          min: 1,
          max: 8,
          required: true,
          when: (v) => v.format === "ROUND_ROBIN",
        },
        ...["Win", "Draw", "Loss"].map((suffix, i) => ({
          name: `pointsFor${suffix}`,
          label: ["Очки за победу", "Очки за ничью", "Очки за поражение"][i],
          type: "number",
          min: 0,
          required: true,
          when: (v: Values) => v.format === "ROUND_ROBIN",
        })),
        {
          name: "tieBreakers",
          label: "При равенстве очков",
          required: true,
          options: [
            {
              value: "headToHead, goalDifference, goalsScored",
              label: "Личные встречи → разница мячей → забитые",
            },
            {
              value: "goalDifference, goalsScored, headToHead",
              label: "Разница мячей → забитые → личные встречи",
            },
            {
              value: "wins, goalDifference, goalsScored",
              label: "Победы → разница мячей → забитые",
            },
            ...(settings.tieBreakers?.length
              ? [
                  {
                    value: settings.tieBreakers.join(", "),
                    label: "Текущий порядок из регламента",
                  },
                ]
              : []),
          ],
          when: (v) => v.format === "ROUND_ROBIN",
        },
        {
          name: "legs",
          label: "Матчей в серии",
          required: true,
          options: [
            { value: "1", label: "Один" },
            { value: "2", label: "Два (дома и в гостях)" },
          ],
          when: (v) => v.format !== "ROUND_ROBIN",
        },
        {
          name: "reset",
          label: "Повторный гранд-финал",
          required: true,
          options: [
            { value: "true", label: "Если победитель верхней сетки проиграл" },
            { value: "false", label: "Без повторного финала" },
          ],
          when: (v) => v.format === "DOUBLE_ELIM",
        },
      );
    setEditor({
      title: s ? "Изменить этап" : "Добавить этап",
      description: generated
        ? "Календарь уже создан: формат и состав этапа зафиксированы."
        : undefined,
      fields,
      values: {
        name: s?.name ?? "",
        sortOrder: String(s?.sortOrder ?? c?.stages.length ?? 0),
        parentStageId: s?.parentStageId ?? "",
        type: s?.type ?? "STAGE",
        format: s?.format ?? "ROUND_ROBIN",
        rounds: String(settings.rounds ?? 1),
        pointsForWin: String(settings.pointsForWin ?? 3),
        pointsForDraw: String(settings.pointsForDraw ?? 1),
        pointsForLoss: String(settings.pointsForLoss ?? 0),
        tieBreakers: (
          settings.tieBreakers ?? [
            "headToHead",
            "goalDifference",
            "goalsScored",
          ]
        ).join(", "),
        legs: String(settings.legsPerRound ?? 1),
        reset: String(settings.grandFinalReset ?? true),
      },
      submit: (v) => {
        if (generated)
          return scheduleApi.updateStage(s!.id, {
            name: v.name,
            sortOrder: integer(v.sortOrder),
          });
        const next: Settings = { qualification: settings.qualification };
        if (v.format === "ROUND_ROBIN") {
          const ties = v.tieBreakers
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          if (
            ties.some(
              (x) =>
                ![
                  "headToHead",
                  "goalDifference",
                  "goalsScored",
                  "wins",
                ].includes(x),
            )
          )
            throw new Error("Неизвестный тай-брейк");
          Object.assign(next, {
            rounds: integer(v.rounds, 1, 8),
            pointsForWin: integer(v.pointsForWin),
            pointsForDraw: integer(v.pointsForDraw),
            pointsForLoss: integer(v.pointsForLoss),
            tieBreakers: ties,
          });
        } else
          Object.assign(next, {
            legsPerRound: integer(v.legs, 1, 2),
            ...(v.format === "DOUBLE_ELIM"
              ? {
                  grandFinalReset: v.reset === "true",
                  dropToLowerBracket: true,
                }
              : {}),
          });
        const body = {
          name: v.name.trim(),
          sortOrder: integer(v.sortOrder),
          type: v.type as StageType,
          format: v.format as Format,
          parentStageId: v.parentStageId || null,
          settings: next,
        };
        return s
          ? scheduleApi.updateStage(s.id, body)
          : scheduleApi.createStage(id, body);
      },
    });
  };
  const slotEditor = () =>
    setEditor({
      title: "Добавить слот участника",
      description: "Команду можно выбрать после жеребьёвки.",
      fields: [
        {
          name: "stageId",
          label: "Этап",
          required: true,
          options: stageOptions.filter(
            (o) =>
              !c?.stages.some((s) => s.parentStageId === o.value) &&
              !c?.stages.find((s) => s.id === o.value)?.settings?.generated,
          ),
        },
        { name: "slotName", label: "Название слота", required: true },
        { name: "seed", label: "Номер посева", type: "number", min: 1 },
        { name: "teamId", label: "Команда", options: teamOptions },
      ],
      values: { stageId: stage?.settings?.generated ? "" : (stage?.id ?? "") },
      submit: (v) =>
        scheduleApi.createSlot(id, {
          stageId: v.stageId,
          slotName: v.slotName.trim(),
          seed: v.seed ? integer(v.seed, 1) : null,
          teamId: v.teamId || null,
          groupName: null,
        }),
    });
  const assign = (s: TeamSlot) =>
    setEditor({
      title: `Назначить команду: ${s.slotName}`,
      fields: [
        {
          name: "teamId",
          label: "Команда",
          required: true,
          options: teamOptions,
        },
      ],
      values: { teamId: s.teamId ?? "" },
      submit: (v) => scheduleApi.assignSlot(s.id, v.teamId),
    });
  const qualify = (s: TeamSlot) => {
    const owner = c!.stages.find((st) => st.id === s.stageId)!;
    const old = owner.settings?.qualification?.find(
      (q) => q.slotName === s.slotName,
    );
    setEditor({
      title: `Квалификация: ${s.slotName}`,
      description:
        "Слот заполнится по итогам выбранной группы. Оставьте его без назначенной команды.",
      fields: [
        {
          name: "sourceStageId",
          label: "Группа-источник",
          required: true,
          options: c!.stages
            .filter(
              (st) =>
                st.format === "ROUND_ROBIN" &&
                st.id !== s.stageId &&
                !c!.stages.some((ch) => ch.parentStageId === st.id),
            )
            .map((st) => ({ value: st.id, label: st.name })),
        },
        {
          name: "sourcePosition",
          label: "Место в группе",
          type: "number",
          min: 1,
          required: true,
        },
      ],
      values: {
        sourceStageId: old?.sourceStageId ?? "",
        sourcePosition: String(old?.sourcePosition ?? 1),
      },
      submit: (v) =>
        scheduleApi.updateStage(owner.id, {
          settings: {
            ...stripSettings(owner.settings),
            qualification: [
              ...(owner.settings?.qualification ?? []).filter(
                (q) => q.slotName !== s.slotName,
              ),
              {
                slotName: s.slotName,
                sourceType: "GROUP",
                sourceStageId: v.sourceStageId,
                sourcePosition: integer(v.sourcePosition, 1),
              },
            ],
          },
        }),
    });
  };
  const generate = () =>
    setEditor({
      title: "Сформировать календарь",
      description:
        "Для каждого конечного этапа нужно от 2 до 128 слотов. Повторная генерация и удаление отдельных сгенерированных матчей недоступны.",
      fields: [
        {
          name: "cityId",
          label: "Город",
          required: true,
          options: cityOptions,
        },
        {
          name: "firstMatchDate",
          label: "Дата и время первого матча",
          type: "datetime-local",
          required: true,
        },
        {
          name: "intervalDays",
          label: "Интервал между турами, дней",
          type: "number",
          min: 1,
          required: true,
        },
      ],
      values: {
        firstMatchDate: `${c!.tournament.startDate}T12:00`,
        intervalDays: "1",
      },
      submit: (v) =>
        scheduleApi.generate(id, {
          cityId: v.cityId,
          firstMatchDate: new Date(v.firstMatchDate).toISOString(),
          intervalDays: integer(v.intervalDays, 1),
        }),
    });
  const matchEditor = (m?: Match) =>
    setEditor({
      title: m ? "Дата и место матча" : "Добавить матч вручную",
      fields: [
        ...(!m
          ? [
              {
                name: "stageId",
                label: "Этап",
                required: true,
                options: stageOptions.filter((o) => o.value === stage?.id),
              },
              {
                name: "homeSlotId",
                label: "Слот хозяев",
                required: true,
                options: c!.slots
                  .filter((s) => s.stageId === stage?.id)
                  .map((s) => ({ value: s.id, label: s.slotName })),
              },
              {
                name: "awaySlotId",
                label: "Слот гостей",
                required: true,
                options: c!.slots
                  .filter((s) => s.stageId === stage?.id)
                  .map((s) => ({ value: s.id, label: s.slotName })),
              },
            ]
          : []),
        {
          name: "matchDate",
          label: "Дата и время",
          type: "datetime-local",
          required: true,
        },
        {
          name: "cityId",
          label: "Город",
          required: true,
          options: cityOptions,
        },
      ],
      values: {
        stageId: stage?.id ?? "",
        matchDate: m
          ? localDate(m.matchDate)
          : `${c!.tournament.startDate}T12:00`,
        cityId: m?.cityId ?? "",
      },
      submit: (v) => {
        const fields = {
          matchDate: new Date(v.matchDate).toISOString(),
          cityId: v.cityId,
        };
        if (m) return scheduleApi.updateMatch(m.id, fields);
        if (v.homeSlotId === v.awaySlotId)
          throw new Error("Выберите двух разных участников");
        return scheduleApi.createMatch(id, {
          ...fields,
          stageId: v.stageId,
          homeSlotId: v.homeSlotId,
          awaySlotId: v.awaySlotId,
          homeTeamId: null,
          awayTeamId: null,
          homeScore: null,
          awayScore: null,
        });
      },
    });
  const score = (m: Match) =>
    setEditor({
      title: "Результат матча",
      description: `${participant(m, "home")} — ${participant(m, "away")}`,
      fields: [
        {
          name: "homeScore",
          label: "Голы хозяев",
          type: "number",
          min: 0,
          required: true,
        },
        {
          name: "awayScore",
          label: "Голы гостей",
          type: "number",
          min: 0,
          required: true,
        },
      ],
      values: {
        homeScore: m.homeScore === null ? "" : String(m.homeScore),
        awayScore: m.awayScore === null ? "" : String(m.awayScore),
      },
      submit: (v) =>
        scheduleApi.updateMatch(m.id, {
          homeScore: integer(v.homeScore),
          awayScore: integer(v.awayScore),
        }),
    });
  const decide = (m: Match) => {
    const owner = c!.stages.find((s) => s.id === m.stageId)!;
    const series = Object.entries(owner.settings?.generated?.series ?? {}).find(
      ([, ids]) => ids.includes(m.id),
    );
    if (!series) return;
    setEditor({
      title: "Победитель при равном счёте серии",
      description:
        "Выберите команду, прошедшую дальше по дополнительному регламенту (например, после пенальти). Затем обновите сетку.",
      fields: [
        {
          name: "winner",
          label: "Победитель",
          required: true,
          options: [
            { value: m.homeTeamId!, label: participant(m, "home") },
            { value: m.awayTeamId!, label: participant(m, "away") },
          ],
        },
      ],
      submit: (v) =>
        scheduleApi.updateStage(owner.id, {
          settings: {
            ...stripSettings(owner.settings),
            decisions: { ...owner.settings?.decisions, [series[0]]: v.winner },
          },
        }),
    });
  };
  const resolve = () =>
    confirm(
      "Заполнить сетку по результатам",
      "Будут обработаны завершённые группы и серии. При ничьей или незавершённом источнике слот останется в ожидании.",
      async () => {
        const rules = await scheduleApi.resolve(stage!.id);
        setMessage(
          `Заполнено слотов: ${rules.filter((r) => r.resolvedTeamId).length} из ${rules.length}`,
        );
      },
    );
  const override = (r: BracketSlot) =>
    setEditor({
      title: "Назначить участника вручную",
      description: "Назначение обновит все матчи, использующие этот слот.",
      fields: [
        {
          name: "teamId",
          label: "Команда",
          required: true,
          options: teamOptions,
        },
      ],
      submit: (v) => scheduleApi.overrideRule(r.id, v.teamId),
    });
  const ruleLabel = (r: BracketSlot) =>
    r.sourceType === "GROUP"
      ? `${c?.stages.find((s) => s.id === r.sourceStageId)?.name ?? "Группа"}${r.sourceGroupName ? ` / ${r.sourceGroupName}` : ""}, место ${r.sourcePosition}`
      : `${r.sourceType === "WINNER" ? "Победитель" : "Проигравший"} матча №${(c?.matches.findIndex((m) => m.id === r.sourceMatchId) ?? -1) + 1}`;
  const addRule = () =>
    setEditor({
      title: "Правило заполнения участника",
      fields: [
        {
          name: "matchId",
          label: "Матч",
          required: true,
          options: c!.matches
            .filter((m) => m.stageId === stage?.id)
            .map((m) => ({
              value: m.id,
              label: `№${c!.matches.indexOf(m) + 1}: ${participant(m, "home")} — ${participant(m, "away")}`,
            })),
        },
        {
          name: "side",
          label: "Сторона",
          required: true,
          options: [
            { value: "HOME", label: "Хозяева" },
            { value: "AWAY", label: "Гости" },
          ],
        },
        {
          name: "sourceType",
          label: "Источник",
          required: true,
          options: [
            { value: "GROUP", label: "Место в группе" },
            { value: "WINNER", label: "Победитель матча" },
            { value: "LOSER", label: "Проигравший матча" },
          ],
        },
        {
          name: "sourceStageId",
          label: "Группа",
          required: true,
          options: c!.stages
            .filter((s) => s.format === "ROUND_ROBIN" && s.id !== stage?.id)
            .map((s) => ({ value: s.id, label: s.name })),
          when: (v) => v.sourceType === "GROUP",
        },
        {
          name: "sourcePosition",
          label: "Место",
          type: "number",
          min: 1,
          required: true,
          when: (v) => v.sourceType === "GROUP",
        },
        {
          name: "sourceMatchId",
          label: "Исходный матч",
          required: true,
          options: c!.matches.map((m) => ({
            value: m.id,
            label: `Матч №${c!.matches.indexOf(m) + 1}`,
          })),
          when: (v) => v.sourceType !== "GROUP",
        },
      ],
      values: { side: "HOME", sourceType: "GROUP", sourcePosition: "1" },
      submit: (v) =>
        scheduleApi.createRule({
          matchId: v.matchId,
          side: v.side as "HOME",
          sourceType: v.sourceType as "GROUP",
          sourceStageId: v.sourceType === "GROUP" ? v.sourceStageId : null,
          sourcePosition:
            v.sourceType === "GROUP" ? integer(v.sourcePosition, 1) : null,
          sourceGroupName: null,
          sourceMatchId: v.sourceType === "GROUP" ? null : v.sourceMatchId,
        }),
    });
  if (!c)
    return (
      <QueryState
        loading={data.isPending}
        error={data.error}
        retry={() => data.refetch()}
      />
    );
  const matches = c.matches.filter(
    (m) =>
      (!stage || m.stageId === stage.id) &&
      (status === "all" ||
        (status === "played" ? m.homeScore !== null : m.homeScore === null)),
  );
  const slots = c.slots.filter((s) => s.stageId === stage?.id);
  const rules = c.bracketSlots.filter((r) =>
    c.matches.some((m) => m.id === r.matchId && m.stageId === stage?.id),
  );
  const generated = !!stage?.settings?.generated;
  const tree = c.stages
    .flatMap((s) => {
      const path: Stage[] = [];
      let parent = s.parentStageId;
      const seen = new Set([s.id]);
      while (parent && !seen.has(parent)) {
        seen.add(parent);
        const p = c.stages.find((x) => x.id === parent);
        if (!p) break;
        path.unshift(p);
        parent = p.parentStageId;
      }
      return [
        {
          ...s,
          depth: path.length,
          path: [...path, s]
            .map((x) => `${String(x.sortOrder).padStart(6, "0")}-${x.id}`)
            .join("/"),
        },
      ];
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  return (
    <Stack spacing={3}>
      <Button
        component={Link}
        to="/tournaments"
        sx={{ alignSelf: "flex-start" }}
      >
        ← Все турниры
      </Button>
      <Stack
        direction="row"
        useFlexGap
        sx={{ gap: 2, alignItems: "center", flexWrap: "wrap" }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">{c.tournament.name}</Typography>
          <Typography color="text.secondary">
            {tournamentTypes[c.tournament.type]} · {c.tournament.season} ·{" "}
            {displayDate(c.tournament.startDate)} —{" "}
            {displayDate(c.tournament.endDate)}
          </Typography>
        </Box>
        <Button
          onClick={() =>
            setEditor({
              title: "Настройки турнира",
              fields: tournamentFields,
              values: {
                name: c.tournament.name,
                season: c.tournament.season,
                type: c.tournament.type,
                startDate: c.tournament.startDate,
                endDate: c.tournament.endDate,
              },
              submit: (v) =>
                scheduleApi.updateTournament(id, {
                  name: v.name,
                  season: v.season,
                  type: v.type as "LEAGUE",
                  ...dateRange(v),
                }),
            })
          }
        >
          Настройки
        </Button>
        <Button
          onClick={() => download(`${c.tournament.name}-calendar.json`, c)}
        >
          Экспорт
        </Button>
        <Button onClick={refresh}>Обновить</Button>
        <Button
          variant="contained"
          onClick={generate}
          disabled={
            !!c.matches.length || !c.stages.length || !cities.data?.length
          }
        >
          Сформировать календарь
        </Button>
      </Stack>
      {message && <Alert onClose={() => setMessage("")}>{message}</Alert>}
      <QueryState
        error={data.error || teams.error || cities.error}
        retry={() => {
          refresh();
        }}
      />
      <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
        <Chip label={`Этапов: ${c.stages.length}`} />
        <Chip label={`Матчей: ${c.matches.length}`} />
        <Chip
          label={`Сыграно: ${c.matches.filter((m) => m.homeScore !== null).length}`}
        />
      </Stack>
      {!c.stages.length && (
        <Alert severity="info">
          Добавьте этап, затем создайте слоты участников. Или создайте новый
          турнир из готового шаблона.
        </Alert>
      )}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Разделы турнира"
      >
        {["Календарь", "Этапы", "Участники", "Таблица", "Сетка"].map((t) => (
          <Tab label={t} key={t} />
        ))}
      </Tabs>
      {tab !== 1 && !!c.stages.length && (
        <TextField
          select
          label="Этап"
          value={stage?.id ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          sx={{ maxWidth: 440 }}
        >
          {stageOptions.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label} ·{" "}
              {formats[c.stages.find((s) => s.id === o.value)!.format]}
            </MenuItem>
          ))}
        </TextField>
      )}
      {tab === 0 && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Матчи"
              select
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="played">Сыгранные</MenuItem>
              <MenuItem value="pending">Предстоящие</MenuItem>
            </TextField>
            <Button
              disabled={
                !stage || generated || !cities.data?.length || slots.length < 2
              }
              onClick={() => matchEditor()}
            >
              Добавить матч
            </Button>
          </Stack>
          <DataTable
            headers={["№ / Тур", "Дата", "Матч", "Счёт", "Город", "Действия"]}
            empty={!matches.length}
          >
            {matches.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  №{c.matches.indexOf(m) + 1} /{" "}
                  {stage?.settings?.generated?.roundByMatch[m.id] ?? "—"}
                </TableCell>
                <TableCell>
                  {new Date(m.matchDate).toLocaleString("ru-RU", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell>
                  {participant(m, "home")} — {participant(m, "away")}
                </TableCell>
                <TableCell>
                  {m.homeScore === null
                    ? "—"
                    : `${m.homeScore} : ${m.awayScore}`}
                </TableCell>
                <TableCell>{cityName(m.cityId)}</TableCell>
                <TableCell>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                    <Button
                      disabled={!m.homeTeamId || !m.awayTeamId}
                      onClick={() => score(m)}
                    >
                      Счёт
                    </Button>
                    <Button onClick={() => matchEditor(m)}>Перенести</Button>
                    {stage?.format !== "ROUND_ROBIN" && (
                      <Button
                        disabled={
                          !m.homeTeamId || !m.awayTeamId || m.homeScore === null
                        }
                        onClick={() => decide(m)}
                      >
                        Победитель серии
                      </Button>
                    )}
                    {!generated && (
                      <Button
                        color="error"
                        onClick={() =>
                          confirm(
                            "Удалить матч?",
                            "Действие нельзя отменить.",
                            () => scheduleApi.deleteMatch(m.id),
                            true,
                          )
                        }
                      >
                        Удалить
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </Stack>
      )}
      {tab === 1 && (
        <Stack spacing={2}>
          <Button
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
            onClick={() => stageEditor()}
          >
            Добавить этап
          </Button>
          <DataTable
            headers={["Иерархия", "Тип", "Формат", "Календарь", "Действия"]}
            empty={!tree.length}
          >
            {tree.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Box sx={{ pl: s.depth * 2 }}>
                    {s.depth ? "↳ " : ""}
                    {s.name}
                  </Box>
                </TableCell>
                <TableCell>{stageTypes[s.type]}</TableCell>
                <TableCell>{formats[s.format]}</TableCell>
                <TableCell>
                  {s.settings?.generated ? "Создан" : "Подготовка"}
                </TableCell>
                <TableCell>
                  <Button onClick={() => stageEditor(s)}>Изменить</Button>
                  <Button
                    color="error"
                    disabled={!!s.settings?.generated}
                    onClick={() =>
                      confirm(
                        `Удалить «${s.name}»?`,
                        "Сначала удалите слоты и дочерние этапы.",
                        () => scheduleApi.deleteStage(s.id),
                        true,
                      )
                    }
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </Stack>
      )}
      {tab === 2 && (
        <Stack spacing={2}>
          <Button
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
            disabled={!stage || generated}
            onClick={slotEditor}
          >
            Добавить слот
          </Button>
          <Typography color="text.secondary">
            Слоты позволяют подготовить календарь до жеребьёвки. Внутренние
            слоты победителей заполняются резолвером.
          </Typography>
          <DataTable
            headers={["Слот", "Посев", "Команда / источник", "Действия"]}
            empty={!slots.length}
          >
            {slots.map((s) => {
              const rule = stage?.settings?.qualification?.find(
                (q) => q.slotName === s.slotName,
              );
              const automatic = c.bracketSlots.some((r) =>
                c.matches.some(
                  (m) =>
                    m.id === r.matchId &&
                    (r.side === "HOME" ? m.homeSlotId : m.awaySlotId) === s.id,
                ),
              );
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.slotName}</TableCell>
                  <TableCell>{s.seed ?? "—"}</TableCell>
                  <TableCell>
                    {s.teamId
                      ? teamName(s.teamId)
                      : rule
                        ? `${c.stages.find((st) => st.id === rule.sourceStageId)?.name ?? "Источник"}, место ${rule.sourcePosition}`
                        : "Не назначена"}
                  </TableCell>
                  <TableCell>
                    <Button
                      disabled={automatic || !!rule || !teamOptions.length}
                      onClick={() => assign(s)}
                    >
                      Назначить команду
                    </Button>
                    {!generated && (
                      <>
                        <Button
                          disabled={!!s.teamId}
                          onClick={() => qualify(s)}
                        >
                          Из группы
                        </Button>
                        {rule && <Button onClick={() => confirm('Убрать источник квалификации?', 'После этого команду можно назначить вручную.', () => scheduleApi.updateStage(stage!.id, {settings: {...stripSettings(stage!.settings), qualification: (stage!.settings?.qualification ?? []).filter(q => q.slotName !== s.slotName)}}))}>Убрать источник</Button>}
                        <Button
                          disabled={!!rule}
                          color="error"
                          onClick={() =>
                            confirm(
                              `Удалить слот «${s.slotName}»?`,
                              "Слот, который используется матчами, удалить нельзя.",
                              () => scheduleApi.deleteSlot(s.id),
                              true,
                            )
                          }
                        >
                          Удалить
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </DataTable>
        </Stack>
      )}
      {tab === 3 &&
        (stage?.format === "ROUND_ROBIN" ? (
          <Stack spacing={2}>
            <QueryState
              loading={table.isPending}
              error={table.error}
              retry={() => table.refetch()}
            />
            {table.data && (
              <DataTable
                headers={[
                  "Место",
                  "Команда",
                  "И",
                  "В",
                  "Н",
                  "П",
                  "Мячи",
                  "Разница",
                  "Очки",
                ]}
                empty={!table.data.length}
              >
                {table.data.map((row) => (
                  <TableRow key={row.teamId}>
                    <TableCell>
                      {row.position}
                      {row.tied ? " =" : ""}
                    </TableCell>
                    <TableCell>{teamName(row.teamId)}</TableCell>
                    <TableCell>{row.played}</TableCell>
                    <TableCell>{row.wins}</TableCell>
                    <TableCell>{row.draws}</TableCell>
                    <TableCell>{row.losses}</TableCell>
                    <TableCell>
                      {row.goalsFor}:{row.goalsAgainst}
                    </TableCell>
                    <TableCell>{row.goalDifference}</TableCell>
                    <TableCell>
                      <strong>{row.points}</strong>
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            )}
            <Typography variant="body2" color="text.secondary">
              «=» — команды равны по всем критериям. Автоматическая квалификация
              такого места ждёт решения регламента.
            </Typography>
          </Stack>
        ) : (
          <Alert severity="info">
            Таблица доступна для круговых этапов. Для плей-офф откройте вкладку
            «Сетка».
          </Alert>
        ))}
      {tab === 4 && (
        <Stack spacing={2}>
          <Stack direction="row" sx={{ gap: 2 }}>
            <Button
              variant="contained"
              disabled={!stage || !rules.length}
              onClick={resolve}
            >
              Заполнить по результатам
            </Button>
            <Button disabled={!stage || !c.matches.length} onClick={addRule}>
              Добавить правило
            </Button>
          </Stack>
          {stage?.settings?.generated?.reset && (
            <Alert severity="info">
              Повторный финал зарезервирован в календаре. Он заполняется только
              при поражении победителя верхней сетки в первом финале.
            </Alert>
          )}
          <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 2 }}>
            {c.matches
              .filter((m) => m.stageId === stage?.id)
              .map((m) => (
                <Paper
                  key={m.id}
                  variant="outlined"
                  sx={{ p: 2, minWidth: 240, maxWidth: 300, flexShrink: 0 }}
                >
                  <Typography variant="overline">
                    Матч №{c.matches.indexOf(m) + 1}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(m.matchDate).toLocaleString("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </Typography>
                  {(["home", "away"] as const).map((side) => (
                    <Box key={side} sx={{ my: 1 }}>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between" }}
                      >
                        <Typography>{participant(m, side)}</Typography>
                        <strong>{m[`${side}Score`] ?? "—"}</strong>
                      </Stack>
                      {c.bracketSlots
                        .filter(
                          (r) =>
                            r.matchId === m.id &&
                            r.side === (side === "home" ? "HOME" : "AWAY"),
                        )
                        .map((r) => (
                          <Typography
                            key={r.id}
                            variant="caption"
                            color="text.secondary"
                          >
                            ← {ruleLabel(r)}
                          </Typography>
                        ))}
                    </Box>
                  ))}
                  <Button
                    disabled={!m.homeTeamId || !m.awayTeamId}
                    onClick={() => score(m)}
                  >
                    Внести счёт
                  </Button>
                </Paper>
              ))}
          </Box>
          <DataTable
            headers={["Матч", "Сторона", "Источник", "Участник", "Действия"]}
            empty={!rules.length}
          >
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  №{c.matches.findIndex((m) => m.id === r.matchId) + 1}
                </TableCell>
                <TableCell>{r.side === "HOME" ? "Хозяева" : "Гости"}</TableCell>
                <TableCell>{ruleLabel(r)}</TableCell>
                <TableCell>
                  {r.resolvedTeamId ? teamName(r.resolvedTeamId) : "Ожидание"}
                </TableCell>
                <TableCell>
                  <Button
                    disabled={!!r.resolvedTeamId || !teamOptions.length}
                    onClick={() => override(r)}
                  >
                    Назначить вручную
                  </Button>
                  <Button
                    disabled={!!r.resolvedTeamId}
                    color="error"
                    onClick={() =>
                      confirm(
                        "Удалить правило?",
                        "Автоматическое заполнение этой стороны матча будет отключено.",
                        () => scheduleApi.deleteRule(r.id),
                        true,
                      )
                    }
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </Stack>
      )}
      {!c.matches.length && (
        <Button
          color="error"
          sx={{ alignSelf: "flex-start" }}
          onClick={() =>
            confirm(
              `Удалить турнир «${c.tournament.name}»?`,
              "Все его этапы и слоты будут удалены.",
              async () => {
                await scheduleApi.deleteTournament(id);
                navigate("/tournaments");
              },
              true,
            )
          }
        >
          Удалить турнир
        </Button>
      )}
      {editor && (
        <Editor
          config={editor}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
    </Stack>
  );
}
