import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Stack,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { scheduleApi } from "../../services/schedule";
import type { Reference } from "../../services/schedule";
import { DataTable, Editor, QueryState } from "./shared";
import type { EditorConfig } from "./shared";
export default function ScheduleReferencesPage() {
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const client = useQueryClient();
  const cities = useQuery({
    queryKey: ["schedule", "cities"],
    queryFn: scheduleApi.cities,
  });
  const teams = useQuery({
    queryKey: ["schedule", "teams"],
    queryFn: scheduleApi.teams,
  });
  const city = (item?: Reference) =>
    setEditor({
      title: item ? "Изменить город" : "Добавить город",
      fields: [{ name: "name", label: "Название", required: true }],
      values: { name: item?.name ?? "" },
      submit: (v) => {
        if (!v.name.trim() || v.name.length > 100)
          throw new Error("Название должно содержать от 1 до 100 символов");
        return item
          ? scheduleApi.updateCity(String(item.id), v.name.trim())
          : scheduleApi.createCity(v.name.trim());
      },
    });
  const team = (item?: Reference) =>
    setEditor({
      title: item ? "Изменить команду" : "Добавить команду",
      fields: [
        { name: "name", label: "Название", required: true },
        {
          name: "cityId",
          label: "Город",
          required: true,
          options: (cities.data ?? []).map((c) => ({
            value: String(c.id),
            label: c.name,
          })),
        },
      ],
      values: {
        name: item?.name ?? "",
        cityId: item?.cityId ? String(item.cityId) : "",
      },
      submit: (v) => {
        if (!v.name.trim() || v.name.length > 100)
          throw new Error("Название должно содержать от 1 до 100 символов");
        return item
          ? scheduleApi.updateTeam(
              String(item.id),
              v.name.trim(),
              v.cityId,
            )
          : scheduleApi.createTeam(
              v.name.trim(),
              v.cityId,
            );
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
      <Typography variant="h4">Команды и города</Typography>
      <Alert severity="info">
        Команды и города сохраняются в базе. Добавьте город, затем создайте команды и назначьте их слотам турнира.
      </Alert>
      <QueryState
        loading={teams.isPending || cities.isPending}
        error={teams.error || cities.error}
        retry={() => {
          cities.refetch();
          teams.refetch();
        }}
      />
      <Stack direction="row" spacing={2}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Города
        </Typography>
        <Button onClick={() => city()}>Добавить город</Button>
      </Stack>
      <DataTable headers={["Название", ""]} empty={!cities.data?.length}>
        {cities.data?.map((c) => (
          <TableRow key={c.id}>
            <TableCell>{c.name}</TableCell>
            <TableCell>
              <Button onClick={() => city(c)}>Изменить</Button>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
      <Stack direction="row" spacing={2}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Команды
        </Typography>
        <Button disabled={!cities.data?.length} onClick={() => team()}>
          Добавить команду
        </Button>
      </Stack>
      <DataTable
        headers={["Название", "Город", ""]}
        empty={!teams.data?.length}
      >
        {teams.data?.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{t.name}</TableCell>
            <TableCell>
              {cities.data?.find((c) => String(c.id) === String(t.cityId))
                ?.name ?? "—"}
            </TableCell>
            <TableCell>
              <Button onClick={() => team(t)}>Изменить</Button>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
      {editor && (
        <Editor
          config={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            client.invalidateQueries({ queryKey: ["schedule"] });
          }}
        />
      )}
    </Stack>
  );
}
