// src/api/api.ts

import axios, { AxiosError } from 'axios';
import {
  User,
  CreateUserData,
  UpdateUserData,
  SignInCredentials,
  SignUpCredentials,
  AuthTokens,
  List,
  CreateListDto,
  TestType,
  CreateTestTypeDto,
  UpdateTestTypeDto,
  GetTestTypesQuery,
  TrainingCamp,
  CreateTrainingCampDto,
  StandardsReportItem,
  Questionnaire,
  CreateQuestionnaireData,
  UpdateQuestionnaireData,
  CreateQuestionnaireByEmail,
  QuestionnaireWithUser,
  PaginatedResponse,
  // Новые DTO
  CampUserDto,
  CampParticipationDto,
  // Градации тестов
  TestGrade,
  CreateTestGradeDto,
  UpdateTestGradeDto,
  ApplyTestGradeDiffDto,
  // Результаты тестов
  Result,
  CreateResultsDto,
  UploadResultsDto,
  UpdateResultDto,
  GetResultsQuery,
  // OAuth / Связанные аккаунты
  PolarStatusResponse,
  UpdateTrainingSessionData,
  RawSamplesResponse,
  TrainingSessionWithSamples,
  // ===== Календарь и судейство =====
  Tournament,
  CreateTournamentDto,
  UpdateTournamentDto,
  FindTournamentsQuery,
  Stage,
  CreateStageDto,
  UpdateStageDto,
  FindStagesQuery,
  StageTreeItem,
  City,
  CreateCityDto,
  UpdateCityDto,
  FindCitiesQuery,
  Team,
  CreateTeamDto,
  UpdateTeamDto,
  FindTeamsQuery,
  Match,
  CreateMatchDto,
  UpdateMatchDto,
  FindMatchesQuery,
  MatchCrew,
  FieldRole,
  CreateFieldRoleDto,
  UpdateFieldRoleDto,
  FindFieldRolesQuery,
  Assignment,
  CreateAssignmentDto,
  UpdateAssignmentDto,
  FindAssignmentsQuery,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json', 'Accept-Language': 'ru' },
});

// Перехватчик запросов – добавляет токен
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// Перехватчик ответов – логирует ошибки
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('Ошибка API', error.config?.method?.toUpperCase(), error.config?.url, error.response?.status);
    return Promise.reject(error);
  },
);

// ==== Auth API ====
export const authApi = {
  signIn: (data: SignInCredentials) =>
    api.post<AuthTokens>('/auth/signin', data),
  signUp: (data: SignUpCredentials) =>
    api.post<AuthTokens>('/auth/signup', data),
  refresh: (refreshToken: string) =>
    api.post<AuthTokens>('/auth/refresh', { refreshToken }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/change-password', data),
  createActivationUrl: (userId: string) =>
    api.post<{ activationUrl: string }>('/auth/activation-url', { userId }),
};

// ==== User API ====
export const userApi = {
  getUsers: (params?: {
    limit?: number;
    offset?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    orderBy?: 'created_at' | 'first_name' | 'last_name' | 'email';
    orderDir?: 'ASC' | 'DESC';
  }) =>
    api.get<{ rows: User[]; total: number }>('/users', { params }),
  getUser: (id: string) =>
    api.get<User>(`/users/${id}`),
  createUser: (data: CreateUserData) =>
    api.post<User>('/users', data),
  updateUser: (id: string, data: UpdateUserData) =>
    api.put<User>(`/users/${id}`, data),
  deleteUser: (id: string) =>
    api.delete<void>(`/users/${id}`),
};

// ==== List API ====
export const listApi = {
  getLists: (params?: {
    limit?: number;
    offset?: number;
    name?: string;
  }) =>
    api.get<List[]>('/lists', { params }),

  getList: (id: string) =>
    api.get<List>(`/lists/${id}`),

  createList: (data: CreateListDto) =>
    api.post<List>('/lists', data),

  updateList: (id: string, data: Partial<List>) =>
    api.put<List>(`/lists/${id}`, data),

  deleteList: (id: string) =>
    api.delete<void>(`/lists/${id}`),

  getUserListsForList: (listId: string) =>
    api.get<User[]>(`/lists/${listId}/users`),

  assignUserToList: (userId: string, listId: string) =>
    api.post<void>(`/users/${userId}/lists`, { listId }),

  removeUserFromList: (userId: string, listId: string) =>
    api.delete<void>(`/users/${userId}/lists/${listId}`),
};

// ============================================================
//  TEST TYPES API (ОБНОВЛЕНО: полный CRUD + фильтр по полу)
// ============================================================
export const testTypeApi = {
  getAll: (params?: GetTestTypesQuery) =>
    api.get<PaginatedResponse<TestType>>('/test-types', { params }),

  getById: (id: string) =>
    api.get<TestType>(`/test-types/${id}`),

  create: (data: CreateTestTypeDto) =>
    api.post<TestType>('/test-types', data),

  update: (id: string, data: UpdateTestTypeDto) =>
    api.patch<TestType>(`/test-types/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/test-types/${id}`),
};

// ==== Test Grades API ====
export const testGradeApi = {
  getAllByTestType: (testTypeId: string) =>
    api.get<TestGrade[]>(`/test-types/${testTypeId}/grades`),

  getOne: (testTypeId: string, gradeId: string) =>
    api.get<TestGrade>(`/test-types/${testTypeId}/grades/${gradeId}`),

  create: (testTypeId: string, data: CreateTestGradeDto) =>
    api.post<TestGrade>(`/test-types/${testTypeId}/grades`, data),

  update: (
    testTypeId: string,
    gradeId: string,
    data: UpdateTestGradeDto,
  ) =>
    api.patch<TestGrade>(
      `/test-types/${testTypeId}/grades/${gradeId}`,
      data,
    ),

  remove: (testTypeId: string, gradeId: string) =>
    api.delete<void>(`/test-types/${testTypeId}/grades/${gradeId}`),

  applyDiff: (testTypeId: string, diff: ApplyTestGradeDiffDto) =>
    api.patch<TestGrade[]>(`/test-types/${testTypeId}/grades`, diff),
};

// ============================================================
//  ТРЕНИРОВОЧНЫЕ ЛАГЕРЯ (FULL CRUD)
// ============================================================
export const trainingCampApi = {
  getAll: (params?: {
    limit?: number;
    offset?: number;
    name?: string;
    location?: string;
    orderBy?: 'start_date' | 'end_date' | 'name';
    orderDir?: 'ASC' | 'DESC';
  }) =>
    api.get<PaginatedResponse<TrainingCamp>>('/training-camps', { params }),

  getById: (id: string) =>
    api.get<TrainingCamp>(`/training-camps/${id}`),

  create: (data: CreateTrainingCampDto) =>
    api.post<TrainingCamp>('/training-camps', data),

  update: (id: string, data: Partial<CreateTrainingCampDto>) =>
    api.put<TrainingCamp>(`/training-camps/${id}`, { id, ...data }),

  delete: (id: string) =>
    api.delete<void>(`/training-camps/${id}`),
};

// ============================================================
//  УЧАСТНИКИ ЛАГЕРЕЙ (НОВЫЕ REST-МАРШРУТЫ)
// ============================================================
export const campParticipantApi = {
  getByCamp: (campId: string) =>
    api.get<CampUserDto[]>(`/camps/${campId}/users`),

  addOne: (campId: string, userId: string) =>
    api.post<CampUserDto>(`/camps/${campId}/users`, { userId }),

  bulkAdd: (campId: string, userIds: string[]) =>
    api.post<CampUserDto[]>(`/camps/${campId}/users/bulk`, { userIds }),

  getOne: (campId: string, userId: string) =>
    api.get<CampUserDto>(`/camps/${campId}/users/${userId}`),

  updateBib: (campId: string, userId: string, bib: number) =>
    api.patch<CampUserDto>(`/camps/${campId}/users/${userId}/bib`, { bib }),

  removeOne: (campId: string, userId: string) =>
    api.delete<void>(`/camps/${campId}/users/${userId}`),

  bulkRemove: (campId: string, userIds: string[]) =>
    api.delete<void>(`/camps/${campId}/users`, { data: { userIds } }),

  clearAll: (campId: string) =>
    api.delete<void>(`/camps/${campId}`),

  exists: (campId: string, userId: string) =>
    api.get<{ exists: boolean }>(`/camps/exists/${campId}/${userId}`),

  getUserParticipations: (userId: string) =>
    api.get<CampParticipationDto[]>(`/users/${userId}/participations`),
};

// ============================================================
//  РЕЗУЛЬТАТЫ ТЕСТОВ (RESULTS)
// ============================================================
export const resultApi = {
  uploadBulk: (campId: string, body: UploadResultsDto) =>
    api.post<Result[]>(`/results/training-camps/${campId}`, body),

  upsertUserResults: (
    userId: string,
    campId: string,
    body: CreateResultsDto,
  ) =>
    api.post<Result[]>(
      `/results/training-camps/${campId}/users/${userId}`,
      body,
    ),

  getAllByCampAndType: (testTypeId: string, campId: string) =>
    api.get<Result[]>(
      `/results/types/${testTypeId}/training-camps/${campId}`,
    ),

  getAllByTestType: (testTypeId: string, params?: GetResultsQuery) =>
    api.get<PaginatedResponse<Result>>(`/results/types/${testTypeId}`, {
      params,
    }),

  getById: (id: string) =>
    api.get<Result>(`/results/${id}`),

  getAllByComposite: (
    userId: string,
    campId: string,
    isTen: boolean,
    legNumber: number,
  ) =>
    api.get<Result[]>(
      `/results/composite/${userId}/${campId}/${isTen}/${legNumber}`,
    ),

  update: (id: string, data: UpdateResultDto) =>
    api.patch<Result>(`/results/${id}`, data),

  remove: (id: string) =>
    api.delete<void>(`/results/${id}`),

  removeAllByComposite: (
    userId: string,
    campId: string,
    isTen: boolean,
    legNumber: number,
  ) =>
    api.delete<void>(
      `/results/composite/${userId}/${campId}/${isTen}/${legNumber}`,
    ),

  removeAllByUserAndCampAndType: (
    testTypeId: string,
    campId: string,
    userId: string,
  ) =>
    api.delete<void>(
      `/results/types/${testTypeId}/training-camps/${campId}/users/${userId}`,
    ),
};

// ==== Standards Report API ====
export const standardsReportApi = {
  getReport: (params: {
    testTypeId: string;
    listId: string;
    trainingCampId?: string;
  }) =>
    api.get<StandardsReportItem[]>(
      `/reports/standards/${params.testTypeId}/lists/${params.listId}`,
      { params: params.trainingCampId ? { trainingCampId: params.trainingCampId } : {} },
    ),
};

// ==== Questionnaires API ====
export const questionnaireApi = {
  getAll: (params?: {
    listIds?: string[];
    userIds?: string[];
    limit?: number;
    offset?: number;
  }) =>
    api.get<{ rows: QuestionnaireWithUser[]; total: number }>('/questionnaires', {
      params: {
        listIds: params?.listIds?.join(','),
        userIds: params?.userIds?.join(','),
        limit: params?.limit,
        offset: params?.offset,
      },
    }),

  getByUserId: (userId: string) =>
    api.get<QuestionnaireWithUser>(`/questionnaires/${userId}`),

  upsert: (data: CreateQuestionnaireData) =>
    api.post<Questionnaire>('/questionnaires', data),

  upsertBulkByEmail: (items: CreateQuestionnaireByEmail[]) =>
    api.post<Questionnaire[]>('/questionnaires/bulk', { items }),

  update: (userId: string, data: UpdateQuestionnaireData) =>
    api.patch<Questionnaire>(`/questionnaires/${userId}`, data),

  delete: (userId: string) =>
    api.delete<void>(`/questionnaires/${userId}`),
};

// ==== OAuth API ====
export const oauthApi = {
  status: () =>
    api.get<PolarStatusResponse>('/oauth/status'),

  connect: (provider: 'polar') =>
    api.get<{ url: string }>('/oauth/connect', {
      params: { provider, client_type: 'web' },
    }),

  disconnect: () =>
    api.post<{ ok: boolean }>('/oauth/disconnect'),
};

// ==== Training API ====
export const trainingApi = {
  list: (params: {
    from: string;
    to: string;
    limit?: number;
  }) => api.get('/training-sessions', { params }),

  getOne: (provider: string, externalId: string) =>
    api.get<TrainingSessionWithSamples>(
      `/training-sessions/${provider}/${externalId}`,
    ),

  getRawSamples: (provider: string, externalId: string) =>
    api.get<RawSamplesResponse>(
      `/training-sessions/${provider}/${externalId}/raw-samples`,
    ),

  update: (
    provider: string,
    externalId: string,
    data: Partial<UpdateTrainingSessionData>,
  ) =>
    api.patch(`/training-sessions/${provider}/${externalId}`, data),

  delete: (provider: string, externalId: string) =>
    api.delete(`/training-sessions/${provider}/${externalId}`),
};

// ============================================================
//  TOURNAMENTS API (Турниры)
// ============================================================
//
// Турниры — корневая сущность календаря. Управляются администратором.
// Пагинации нет: турниров в системе единицы (4–7 в год).
// Фильтры: season (точное), type (точное), name (частичное).
// ============================================================
export const tournamentApi = {
  /**
   * GET /tournaments
   * Список турниров с фильтрами и сортировкой.
   */
  getAll: (params?: FindTournamentsQuery) =>
    api.get<Tournament[]>('/tournaments', { params }),

  /**
   * GET /tournaments/:id
   */
  getById: (id: string) =>
    api.get<Tournament>(`/tournaments/${id}`),

  /**
   * POST /tournaments
   * Создать турнир.
   * `type`: 'LEAGUE' | 'CUP' | 'SUPER_CUP'.
   */
  create: (data: CreateTournamentDto) =>
    api.post<Tournament>('/tournaments', data),

  /**
   * PATCH /tournaments/:id
   * Частичное обновление. `startDate: null` / `endDate: null`
   * очищают соответствующее поле.
   */
  update: (id: string, data: UpdateTournamentDto) =>
    api.patch<Tournament>(`/tournaments/${id}`, data),

  /**
   * DELETE /tournaments/:id
   * 409 Conflict, если есть этапы.
   */
  remove: (id: string) =>
    api.delete<void>(`/tournaments/${id}`),
};

// ============================================================
//  STAGES API (Этапы турнира)
// ============================================================
//
// Этапы — подресурс турнира. URL: /tournaments/:tournamentId/stages.
// Этап бывает GROUP (ROUND_ROBIN), ROUND (ELIMINATION) или
// контейнером STAGE/PLAYOFF (format = null).
// ============================================================
export const stageApi = {
  /**
   * GET /tournaments/:tournamentId/stages
   * Список этапов с фильтрами:
   *   - rootOnly=true     — только корневые;
   *   - parentStageId=X   — дочерние указанного родителя;
   *   - type=GROUP        — фильтр по типу.
   */
  getAll: (tournamentId: string, params?: FindStagesQuery) =>
    api.get<Stage[]>(`/tournaments/${tournamentId}/stages`, { params }),

  /**
   * GET /tournaments/:tournamentId/stages/tree
   * Дерево этапов: корневые с вложенными children.
   */
  getTree: (tournamentId: string) =>
    api.get<StageTreeItem[]>(`/tournaments/${tournamentId}/stages/tree`),

  /**
   * GET /tournaments/:tournamentId/stages/:stageId
   */
  getOne: (tournamentId: string, stageId: string) =>
    api.get<Stage>(`/tournaments/${tournamentId}/stages/${stageId}`),

  /**
   * POST /tournaments/:tournamentId/stages
   * Создать этап. `format` обязателен для GROUP (ROUND_ROBIN)
   * и ROUND (ELIMINATION). Для STAGE/PLAYOFF — не указывать.
   */
  create: (tournamentId: string, data: CreateStageDto) =>
    api.post<Stage>(`/tournaments/${tournamentId}/stages`, data),

  /**
   * PATCH /tournaments/:tournamentId/stages/:stageId
   * Частичное обновление. `format: null`, `parentStageId: null`,
   * `settings: null` — допустимые значения для обнуления.
   */
  update: (
    tournamentId: string,
    stageId: string,
    data: UpdateStageDto,
  ) =>
    api.patch<Stage>(
      `/tournaments/${tournamentId}/stages/${stageId}`,
      data,
    ),

  /**
   * DELETE /tournaments/:tournamentId/stages/:stageId
   * 409 Conflict, если есть дочерние этапы.
   */
  remove: (tournamentId: string, stageId: string) =>
    api.delete<void>(`/tournaments/${tournamentId}/stages/${stageId}`),
};

// ============================================================
//  CITIES API (Города)
// ============================================================
export const cityApi = {
  /**
   * GET /cities
   * Список городов. `search` — частичный поиск по имени (автокомплит),
   * `region` — точный фильтр.
   */
  getAll: (params?: FindCitiesQuery) =>
    api.get<City[]>('/cities', { params }),

  /**
   * GET /cities/:id
   */
  getById: (id: string) =>
    api.get<City>(`/cities/${id}`),

  /**
   * POST /cities
   */
  create: (data: CreateCityDto) =>
    api.post<City>('/cities', data),

  /**
   * PATCH /cities/:id
   * `region: null` — очистить регион.
   */
  update: (id: string, data: UpdateCityDto) =>
    api.patch<City>(`/cities/${id}`, data),

  /**
   * DELETE /cities/:id
   */
  remove: (id: string) =>
    api.delete<void>(`/cities/${id}`),
};

// ============================================================
//  TEAMS API (Команды)
// ============================================================
export const teamApi = {
  /**
   * GET /teams
   * Список команд. `search` — автокомплит по имени,
   * `cityId` — фильтр по домашнему городу,
   * `shortName` — частичный поиск по короткому имени.
   */
  getAll: (params?: FindTeamsQuery) =>
    api.get<Team[]>('/teams', { params }),

  /**
   * GET /teams/:id
   */
  getById: (id: string) =>
    api.get<Team>(`/teams/${id}`),

  /**
   * POST /teams
   * `cityId` опционален: команда может быть без домашнего города
   * (например, сборная).
   */
  create: (data: CreateTeamDto) =>
    api.post<Team>('/teams', data),

  /**
   * PATCH /teams/:id
   * `shortName: null` и `cityId: null` — обнулить соответствующее поле.
   */
  update: (id: string, data: UpdateTeamDto) =>
    api.patch<Team>(`/teams/${id}`, data),

  /**
   * DELETE /teams/:id
   * 409 Conflict, если команда участвует в матчах.
   */
  remove: (id: string) =>
    api.delete<void>(`/teams/${id}`),
};

// ============================================================
//  MATCHES API (Матчи)
// ============================================================
//
// Два сценария UI:
//   1. Админ внутри этапа: /stages/:stageId/matches — основной.
//   2. Глобальный список с фильтрами: /matches — для отчётов.
//
// Матч идентифицируется своим UUID: /matches/:id.
// `tournamentId` выводится из stage на бэкенде, клиент его
// не передаёт при создании.
// ============================================================
export const matchApi = {
  /**
   * GET /stages/:stageId/matches
   * Все матчи этапа, отсортированы по дате. Без пагинации.
   */
  getByStage: (stageId: string) =>
    api.get<Match[]>(`/stages/${stageId}/matches`),

  /**
   * GET /tournaments/:tournamentId/matches
   * Все матчи турнира, отсортированы по дате. Без пагинации.
   */
  getByTournament: (tournamentId: string) =>
    api.get<Match[]>(`/tournaments/${tournamentId}/matches`),

  /**
   * GET /matches
   * Глобальный список с фильтрами и пагинацией.
   * Возвращает { rows, total }.
   */
  getAll: (params?: FindMatchesQuery) =>
    api.get<PaginatedResponse<Match>>('/matches', { params }),

  /**
   * GET /matches/:id
   */
  getById: (id: string) =>
    api.get<Match>(`/matches/${id}`),

  /**
   * GET /matches/:matchId/crew
   * Матч + команды + город + этап + бригада с ФИО и ролями.
   * Один запрос для страницы матча.
   */
  getCrew: (matchId: string) =>
    api.get<MatchCrew>(`/matches/${matchId}/crew`),

  /**
   * POST /stages/:stageId/matches
   * Создать матч в этапе. `tournamentId` выводится из stage.
   * `tourNumber` — только для ROUND_ROBIN.
   * `homeTeamId` / `awayTeamId` — nullable (для плей-офф).
   */
  create: (stageId: string, data: CreateMatchDto) =>
    api.post<Match>(`/stages/${stageId}/matches`, data),

  /**
   * PATCH /matches/:id
   * `homeTeamId: null` / `awayTeamId: null` / `homeScore: null` /
   * `awayScore: null` / `tourNumber: null` — обнуление.
   */
  update: (id: string, data: UpdateMatchDto) =>
    api.patch<Match>(`/matches/${id}`, data),

  /**
   * DELETE /matches/:id
   */
  remove: (id: string) =>
    api.delete<void>(`/matches/${id}`),
};

// ============================================================
//  FIELD ROLES API (Роли на поле)
// ============================================================
//
// Справочник фиксированный (5 ролей): REFEREE, ASSISTANT, RESERVE,
// VAR, AVAR. В dev создаётся автоматически сидером. В prod —
// вручную один раз при деплое.
//
// `code` — ключ локализации на фронте. `name` — русский fallback.
// ============================================================
export const fieldRoleApi = {
  /**
   * GET /field-roles
   * Список ролей. По умолчанию отсортирован по sortOrder
   * (Главный судья, Помощник, Резервный, VAR, AVAR).
   */
  getAll: (params?: FindFieldRolesQuery) =>
    api.get<FieldRole[]>('/field-roles', { params }),

  /**
   * GET /field-roles/:id
   */
  getById: (id: string) =>
    api.get<FieldRole>(`/field-roles/${id}`),

  /**
   * POST /field-roles
   * Обычно не используется: роли создаются сидером.
   * Оставлено на случай добавления кастомных ролей.
   */
  create: (data: CreateFieldRoleDto) =>
    api.post<FieldRole>('/field-roles', data),

  /**
   * PATCH /field-roles/:id
   */
  update: (id: string, data: UpdateFieldRoleDto) =>
    api.patch<FieldRole>(`/field-roles/${id}`, data),

  /**
   * DELETE /field-roles/:id
   * 409 Conflict, если на роль есть назначения.
   */
  remove: (id: string) =>
    api.delete<void>(`/field-roles/${id}`),
};

// ============================================================
//  ASSIGNMENTS API (Назначения)
// ============================================================
//
// Назначение — связка «судья X на матч Y в роли Z».
// Три обязательные ссылки: matchId, userId, fieldRoleId.
//
// Регламентные проверки на бэкенде (в одной транзакции):
//   1. Матч, судья, роль существуют.
//   2. Судья не назначен на этот матч дважды.
//   3. Судья не назначен на другой матч в тот же день.
//
// Бригада может быть неполной — «на матч должен быть REFEREE»
// не проверяется.
// ============================================================
export const assignmentApi = {
  /**
   * GET /matches/:matchId/assignments
   * Все назначения матча — только ID-ссылки, без ФИО.
   * Для отображения бригады используй matchApi.getCrew().
   */
  getByMatch: (matchId: string) =>
    api.get<Assignment[]>(`/matches/${matchId}/assignments`),

  /**
   * GET /assignments
   * Глобальный список с фильтрами:
   *   - userId        — «где судил Петров»;
   *   - fieldRoleId   — «все VAR»;
   *   - dateFrom/dateTo — «назначения за период».
   * Без пагинации: всегда смотрят с фильтром.
   */
  getAll: (params?: FindAssignmentsQuery) =>
    api.get<Assignment[]>('/assignments', { params }),

  /**
   * GET /assignments/:id
   */
  getById: (id: string) =>
    api.get<Assignment>(`/assignments/${id}`),

  /**
   * POST /matches/:matchId/assignments
   * Назначить судью на матч. `matchId` берётся из URL.
   *
   * Возможные ошибки:
   *   404 — матч/судья/роль не найдены;
   *   409 — дубликат на матче или «два матча в день».
   */
  create: (matchId: string, data: CreateAssignmentDto) =>
    api.post<Assignment>(`/matches/${matchId}/assignments`, data),

  /**
   * PATCH /assignments/:id
   * Заменить судью или роль. При смене судьи — те же проверки
   * (дубликат, «два матча в день»), исключая текущее назначение.
   */
  update: (id: string, data: UpdateAssignmentDto) =>
    api.patch<Assignment>(`/assignments/${id}`, data),

  /**
   * DELETE /assignments/:id
   * Снять назначение.
   */
  remove: (id: string) =>
    api.delete<void>(`/assignments/${id}`),
};

export default api;
