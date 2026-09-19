import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  Stack,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { scheduleApi } from "../../services/schedule";
import type { Template, TemplateSchema, Format } from "../../types/schedule";
import {
  DataTable,
  Editor,
  QueryState,
  integer,
  options,
  formats,
  download,
  dateRange,
  tournamentFields,
} from "./shared";
import type { EditorConfig } from "./shared";
import { buildTemplate } from "./template-builder";
export default function TemplatesPage() {
  const [editor, setEditor] = useState<EditorConfig | null>(null),
    [message, setMessage] = useState("");
  const client = useQueryClient(),
    navigate = useNavigate();
  const list = useQuery({
    queryKey: ["schedule", "templates"],
    queryFn: scheduleApi.templates,
  });
  const cities = useQuery({
    queryKey: ["schedule", "cities"],
    queryFn: scheduleApi.cities,
  });
  const create = () =>
    setEditor({
      title: "Новый шаблон",
      description:
        "Готовый регламент с пустыми слотами команд. Состав участников можно назначить после создания турнира.",
      fields: [
        { name: "name", label: "Название", required: true },
        {
          name: "format",
          label: "Регламент",
          required: true,
          options: [
            ...options(formats),
            { value: "GROUP_PLAYOFF", label: "Две группы + плей-офф" },
          ],
        },
        {
          name: "count",
          label: "Количество участников",
          type: "number",
          min: 2,
          max: 128,
          required: true,
        },
        {
          name: "rounds",
          label: "Кругов в группе",
          type: "number",
          min: 1,
          max: 8,
          required: true,
        },
        {
          name: "cityId",
          label: "Город проведения",
          required: true,
          options: (cities.data ?? []).map((c) => ({
            value: String(c.id),
            label: c.name,
          })),
        },
        {
          name: "interval",
          label: "Интервал между турами, дней",
          type: "number",
          min: 1,
          required: true,
        },
      ],
      values: { format: "ROUND_ROBIN", count: "8", rounds: "1", interval: "1" },
      submit: (v) =>
        scheduleApi.createTemplate({
          name: v.name.trim(),
          description: null,
          version: 1,
          isActive: true,
          schema: buildTemplate(
            v.name.trim(),
            v.cityId,
            v.format as Format,
            integer(v.count, 2, 128),
            integer(v.rounds, 1, 8),
            integer(v.interval, 1),
          ),
        }),
    });
  const edit = (t: Template) =>
    setEditor({
      title: `Настройки шаблона «${t.name}»`,
      description:
        "Расширенный редактор для составных регламентов. Проверка схемы выполняется сервером.",
      fields: [
        { name: "name", label: "Название", required: true },
        { name: "description", label: "Описание" },
        {
          name: "version",
          label: "Версия",
          type: "number",
          min: 1,
          required: true,
        },
        {
          name: "active",
          label: "Доступность",
          required: true,
          options: [
            { value: "true", label: "Доступен" },
            { value: "false", label: "Отключён" },
          ],
        },
        {
          name: "schema",
          label: "Схема регламента (JSON)",
          required: true,
          multiline: true,
        },
      ],
      values: {
        name: t.name,
        description: t.description ?? "",
        version: String(t.version + 1),
        active: String(t.isActive),
        schema: JSON.stringify(t.schema, null, 2),
      },
      submit: (v) => {
        let schema: TemplateSchema;
        try {
          schema = JSON.parse(v.schema);
        } catch {
          throw new Error("Схема содержит некорректный JSON");
        }
        return scheduleApi.updateTemplate(t.id, {
          name: v.name,
          description: v.description || null,
          version: integer(v.version, 1),
          isActive: v.active === "true",
          schema,
        });
      },
    });
  const openTemplateDialog = (t: Template) =>
    setEditor({
      title: `Создать турнир: ${t.name}`,
      fields: tournamentFields.filter((f) =>
        ["season", "startDate", "endDate"].includes(f.name),
      ),
      values: { season: String(new Date().getFullYear()) },
      submit: async (v) => {
        const result = await scheduleApi.createFromTemplate({
          templateId: t.id,
          season: v.season,
          ...dateRange(v),
        });
        navigate(`/tournaments/${result.id}`);
      },
    });
  return (
    <Stack spacing={3}>
      <Button
        component={Link}
        to="/tournaments"
        sx={{ alignSelf: "flex-start" }}
      >
        ← Турниры
      </Button>
      <Stack direction="row" sx={{ gap: 2, alignItems: "center" }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Шаблоны турниров
        </Typography>
        <Button
          variant="contained"
          onClick={create}
          disabled={!cities.data?.length}
        >
          Создать шаблон
        </Button>
      </Stack>
      {message && <Alert onClose={() => setMessage("")}>{message}</Alert>}
      <QueryState
        loading={list.isPending || cities.isPending}
        error={list.error || cities.error}
        retry={() => {
          list.refetch();
          cities.refetch();
        }}
      />
      {list.data && (
        <DataTable
          headers={["Шаблон", "Версия", "Статус", "Действия"]}
          empty={!list.data.length}
        >
          {list.data.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Typography>{t.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t.description}
                </Typography>
              </TableCell>
              <TableCell>{t.version}</TableCell>
              <TableCell>
                <Chip
                  label={t.isActive ? "Доступен" : "Отключён"}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                  <Button disabled={!t.isActive} onClick={() => openTemplateDialog(t)}>
                    Создать турнир
                  </Button>
                  <Button onClick={() => edit(t)}>Изменить</Button>
                  <Button
                    onClick={() =>
                      download("tournament-template.json", t.schema)
                    }
                  >
                    Экспорт
                  </Button>
                  <Button
                    color="error"
                    onClick={() =>
                      setEditor({
                        title: `Удалить «${t.name}»?`,
                        description:
                          "Используемый шаблон удалить нельзя. Его можно отключить в настройках.",
                        fields: [],
                        danger: true,
                        submitLabel: "Удалить",
                        submit: () => scheduleApi.deleteTemplate(t.id),
                      })
                    }
                  >
                    Удалить
                  </Button>
                </Stack>
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
