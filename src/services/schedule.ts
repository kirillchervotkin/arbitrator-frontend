import api from "./api";
import type {
  Tournament,
  Stage,
  TeamSlot,
  Match,
  Template,
  Calendar,
  Standing,
  BracketSlot,
  GenerateOptions,
  Entity,
} from "../types/schedule";
type New<T> = Omit<T, keyof Entity>;
export interface Reference {
  cityId?: string;
  id: string;
  name: string;
}
export interface TournamentFilter {
  season?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}
export const scheduleApi = {
  createCity: (name: string) => api.post("/cities", { name }),
  updateCity: (id: string, name: string) => api.put(`/cities/${id}`, { name }),
  createTeam: (name: string, cityId: string) =>
    api.post("/teams", { name, cityId }),
  updateTeam: (id: string, name: string, cityId: string) =>
    api.put(`/teams/${id}`, { name, cityId }),
  tournaments: (params: TournamentFilter = {}) =>
    api.get<Tournament[]>("/tournaments", { params }).then((r) => r.data),
  calendar: (id: string) =>
    api.get<Calendar>(`/tournaments/${id}/calendar`).then((r) => r.data),
  createTournament: (data: Omit<New<Tournament>, "templateId">) =>
    api.post<Tournament>("/tournaments", data).then((r) => r.data),
  updateTournament: (id: string, data: Partial<New<Tournament>>) =>
    api.put(`/tournaments/${id}`, data),
  deleteTournament: (id: string) => api.delete(`/tournaments/${id}`),
  createFromTemplate: (data: {
    templateId: string;
    season: string;
    startDate: string;
    endDate: string;
  }) =>
    api
      .post<Tournament>("/tournaments/from-template", data)
      .then((r) => r.data),
  generate: (id: string, data: GenerateOptions) =>
    api.post<Match[]>(`/tournaments/${id}/generate-schedule`, data),
  createStage: (id: string, data: Omit<New<Stage>, "tournamentId">) =>
    api.post<Stage>(`/tournaments/${id}/stages`, data).then((r) => r.data),
  updateStage: (id: string, data: Partial<Omit<New<Stage>, "tournamentId">>) =>
    api.put(`/stages/${id}`, data),
  deleteStage: (id: string) => api.delete(`/stages/${id}`),
  createSlot: (id: string, data: Omit<New<TeamSlot>, "tournamentId">) =>
    api.post(`/tournaments/${id}/team-slots`, data),
  assignSlot: (id: string, teamId: string) =>
    api.put(`/team-slots/${id}`, { teamId }),
  deleteSlot: (id: string) => api.delete(`/team-slots/${id}`),
  updateMatch: (id: string, data: Partial<New<Match>>) =>
    api.put(`/matches/${id}`, data),
  createMatch: (id: string, data: Omit<New<Match>, "tournamentId">) =>
    api.post(`/tournaments/${id}/matches`, data),
  deleteMatch: (id: string) => api.delete(`/matches/${id}`),
  standings: (id: string) =>
    api.get<Standing[]>(`/stages/${id}/standings`).then((r) => r.data),
  resolve: (id: string) =>
    api.post<BracketSlot[]>(`/stages/${id}/resolve`, {}).then((r) => r.data),
  createRule: (data: Omit<New<BracketSlot>, "resolvedTeamId">) =>
    api.post("/bracket-slots", data),
  overrideRule: (id: string, resolvedTeamId: string) =>
    api.put(`/bracket-slots/${id}`, { resolvedTeamId }),
  deleteRule: (id: string) => api.delete(`/bracket-slots/${id}`),
  templates: () => api.get<Template[]>("/templates").then((r) => r.data),
  createTemplate: (data: New<Template>) => api.post("/templates", data),
  updateTemplate: (id: string, data: Partial<New<Template>>) =>
    api.put(`/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/templates/${id}`),
  teams: () => api.get<Reference[]>("/teams").then((r) => r.data),
  cities: () => api.get<Reference[]>("/cities").then((r) => r.data),
};
