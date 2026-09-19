import axios from "axios";
export const formats = {
  ROUND_ROBIN: "Круговой",
  SINGLE_ELIM: "Одинарное выбывание",
  DOUBLE_ELIM: "Двойное выбывание",
};
export const tournamentTypes = {
  LEAGUE: "Чемпионат",
  CUP: "Кубок",
  SUPER_CUP: "Суперкубок",
};
export const stageTypes = {
  STAGE: "Этап",
  GROUP: "Группа",
  ROUND: "Раунд",
  PLAYOFF: "Плей-офф",
};
export type Values = Record<string, string>;
export type Option = { value: string; label: string };
export const options = (items: Record<string, string>): Option[] =>
  Object.entries(items).map(([value, label]) => ({ value, label }));
export interface Field {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Option[];
  help?: string;
  min?: number;
  max?: number;
  multiline?: boolean;
  when?: (v: Values) => boolean;
}
export interface EditorConfig {
  title: string;
  description?: string;
  fields: Field[];
  values?: Values;
  submit: (v: Values) => Promise<unknown>;
  submitLabel?: string;
  danger?: boolean;
}
export function errorText(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401)
      return "Сессия истекла. Войдите в аккаунт заново.";
    const data = error.response?.data;
    const reasons = data?.invalid_params?.flatMap((p: { errors?: { reason?: string }[] }) =>
      p.errors?.map((e) => e.reason).filter(Boolean) ?? []);
    if (reasons?.length) return [...new Set(reasons)].join('; ');
    if (data?.type?.endsWith('/resource-in-use'))
      return 'Запись используется другими сущностями. Сначала удалите связанные записи.';
    if (typeof data?.detail === 'string') return data.detail;
    const text = Array.isArray(data?.message)
      ? data.message.join("; ")
      : data?.message;
    return text
      ? `${text}${data?.fields?.length ? `: ${data.fields.join(", ")}` : ""}`
      : "Сервер недоступен. Проверьте подключение и повторите запрос.";
  }
  return error instanceof Error
    ? error.message
    : "Не удалось выполнить операцию";
}
export function integer(value: string, min = 0, max = 2147483647) {
  const number = Number(value);
  if (!value || !Number.isInteger(number) || number < min || number > max)
    throw new Error(`Введите целое число от ${min} до ${max}`);
  return number;
}
export function dateRange(v: Values) {
  if (!v.startDate || !v.endDate || v.endDate < v.startDate)
    throw new Error("Дата окончания должна быть не раньше даты начала");
  return { startDate: v.startDate, endDate: v.endDate };
}
export function localDate(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function displayDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export const tournamentFields: Field[] = [
  { name: "name", label: "Название", required: true },
  { name: "season", label: "Сезон", required: true },
  {
    name: "type",
    label: "Тип турнира",
    required: true,
    options: options(tournamentTypes),
  },
  { name: "startDate", label: "Дата начала", type: "date", required: true },
  { name: "endDate", label: "Дата окончания", type: "date", required: true },
];
