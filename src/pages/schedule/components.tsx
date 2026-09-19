import { useState } from "react";
import type { ReactNode, FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { errorText } from "./model";
import type { Values, EditorConfig } from "./model";
export function Editor({
  config,
  onClose,
  onSaved,
}: {
  config: EditorConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Values>(config.values ?? {});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await config.submit(values);
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open onClose={() => !pending && onClose()} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{config.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {config.description && (
              <Typography color="text.secondary">
                {config.description}
              </Typography>
            )}
            {error && (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            )}
            {config.fields
              .filter((f) => !f.when || f.when(values))
              .map((f) => (
                <TextField
                  key={f.name}
                  label={f.label}
                  value={values[f.name] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                  required={f.required}
                  disabled={pending}
                  fullWidth
                  select={!!f.options}
                  type={f.type ?? "text"}
                  multiline={f.multiline}
                  minRows={f.multiline ? 6 : undefined}
                  helperText={f.help}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: {
                      min: f.min,
                      max: f.max,
                      step: f.type === "number" ? 1 : undefined,
                    },
                  }}
                >
                  {f.options && [
                    !f.required && (
                      <MenuItem key="empty" value="">
                        Не выбрано
                      </MenuItem>
                    ),
                    ...[
                      ...new Map(f.options.map((o) => [o.value, o])).values(),
                    ].map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    )),
                  ]}
                </TextField>
              ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            color={config.danger ? "error" : "primary"}
            disabled={pending}
          >
            {pending ? "Сохранение…" : (config.submitLabel ?? "Сохранить")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
export function DataTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            {headers.map((h) => (
              <TableCell key={h}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {empty ? (
            <TableRow>
              <TableCell colSpan={headers.length}>
                <Typography sx={{ py: 3 }} color="text.secondary">
                  Пока ничего нет
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry: () => void;
}) {
  return loading ? (
    <Box sx={{ p: 4 }} role="status" aria-label="Загрузка">
      <CircularProgress />
    </Box>
  ) : error ? (
    <Alert severity="error" action={<Button onClick={retry}>Повторить</Button>}>
      {errorText(error)}
    </Alert>
  ) : null;
}
