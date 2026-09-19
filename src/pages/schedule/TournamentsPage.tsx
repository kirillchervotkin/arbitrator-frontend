import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import { scheduleApi } from "../../services/schedule";
import {
  DataTable,
  Editor,
  QueryState,
  dateRange,
  displayDate,
  tournamentFields,
  tournamentTypes,
  options,
} from "./shared";
import type { EditorConfig } from "./shared";
export default function TournamentsPage() {
  const [season, setSeason] = useState(""),
    [type, setType] = useState(""),
    [dateFrom, setFrom] = useState(""),
    [dateTo, setTo] = useState("");
  const [editor, setEditor] = useState<EditorConfig | null>(null),
    [message, setMessage] = useState("");
  const navigate = useNavigate(),
    client = useQueryClient();
  const list = useQuery({
    queryKey: ["schedule", "tournaments", season, type, dateFrom, dateTo],
    queryFn: () =>
      scheduleApi.tournaments({
        season: season || undefined,
        type: type || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });
  const templates = useQuery({
    queryKey: ["schedule", "templates"],
    queryFn: scheduleApi.templates,
  });
  const create = () =>
    setEditor({
      title: "Новый турнир",
      fields: tournamentFields,
      values: { season: String(new Date().getFullYear()), type: "LEAGUE" },
      submit: async (v) => {
        const t = await scheduleApi.createTournament({
          name: v.name.trim(),
          season: v.season.trim(),
          type: v.type as "LEAGUE",
          ...dateRange(v),
        });
        navigate(`/tournaments/${t.id}`);
      },
    });
  const fromTemplate = () =>
    setEditor({
      title: "Турнир из шаблона",
      description: "Этапы, слоты и календарь будут созданы автоматически.",
      fields: [
        {
          name: "templateId",
          label: "Шаблон",
          required: true,
          options: (templates.data ?? [])
            .filter((t) => t.isActive)
            .map((t) => ({
              value: t.id,
              label: `${t.name} · версия ${t.version}`,
            })),
        },
        ...tournamentFields.filter((f) =>
          ["season", "startDate", "endDate"].includes(f.name),
        ),
      ],
      values: { season: String(new Date().getFullYear()) },
      submit: async (v) => {
        const t = await scheduleApi.createFromTemplate({
          templateId: v.templateId,
          season: v.season,
          ...dateRange(v),
        });
        navigate(`/tournaments/${t.id}`);
      },
    });
  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Button component={Link} to="/tournaments/references">
          Команды и города
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Турниры
        </Typography>
        <Button component={Link} to="/tournament-templates">
          Шаблоны
        </Button>
        <Button
          variant="outlined"
          disabled={!templates.data?.some((t) => t.isActive)}
          onClick={fromTemplate}
        >
          Из шаблона
        </Button>
        <Button variant="contained" onClick={create}>
          Создать турнир
        </Button>
      </Stack>
      <Typography color="text.secondary">
        Подготовьте этапы и слоты до жеребьёвки. Затем сформируйте календарь и
        назначьте команды.
      </Typography>
      {message && <Alert onClose={() => setMessage("")}>{message}</Alert>}
      {templates.error && (
        <Alert severity="warning">
          Не удалось загрузить шаблоны.{" "}
          <Button onClick={() => templates.refetch()}>Повторить</Button>
        </Alert>
      )}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        useFlexGap
        sx={{ flexWrap: "wrap" }}
      >
        <TextField
          size="small"
          label="Сезон"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
        />
        <TextField
          size="small"
          select
          label="Тип"
          value={type}
          onChange={(e) => setType(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Все типы</MenuItem>
          {options(tournamentTypes).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="С даты"
          type="date"
          value={dateFrom}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          label="По дату"
          type="date"
          value={dateTo}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button onClick={() => list.refetch()}>Обновить</Button>
      </Stack>
      <QueryState
        loading={list.isPending}
        error={list.error}
        retry={() => list.refetch()}
      />
      {list.data && (
        <DataTable
          headers={["Турнир", "Сезон", "Формат", "Даты", ""]}
          empty={!list.data.length}
        >
          {list.data.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Button component={Link} to={`/tournaments/${t.id}`}>
                  {t.name}
                </Button>
              </TableCell>
              <TableCell>{t.season}</TableCell>
              <TableCell>
                <Chip size="small" label={tournamentTypes[t.type]} />
              </TableCell>
              <TableCell>
                {displayDate(t.startDate)} — {displayDate(t.endDate)}
              </TableCell>
              <TableCell>
                <Button
                  onClick={() =>
                    setEditor({
                      title: `Удалить «${t.name}»?`,
                      description:
                        "Можно удалить только турнир без матчей. Дочерние этапы и слоты будут удалены.",
                      fields: [],
                      danger: true,
                      submitLabel: "Удалить",
                      submit: () => scheduleApi.deleteTournament(t.id),
                    })
                  }
                  color="error"
                >
                  Удалить
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
      {editor && (
        <Editor
          config={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            client.invalidateQueries({ queryKey: ["schedule"] });
            setMessage("Изменения сохранены");
          }}
        />
      )}
    </Stack>
  );
}
