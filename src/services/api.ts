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
  /**
   * GET /test-types
   * Получить список типов тестов с фильтрацией и сортировкой.
   */
  getAll: (params?: GetTestTypesQuery) =>
    api.get<PaginatedResponse<TestType>>('/test-types', { params }),

  /**
   * GET /test-types/:id
   */
  getById: (id: string) =>
    api.get<TestType>(`/test-types/${id}`),

  /**
   * POST /test-types
   * Создать тип теста.
   *
   * Внимание: `parameter` бэкенд выводит сам из комбинации
   * failThreshold* — в payload его передавать НЕ нужно.
   */
  create: (data: CreateTestTypeDto) =>
    api.post<TestType>('/test-types', data),

  /**
   * PATCH /test-types/:id
   * Частичное обновление.
   *
   * При смене типа теста (например, time → segments) обязательно
   * передавать все пороговые поля явно — старые значения надо
   * сбрасывать через `null`, иначе сервис сольёт патч с текущей
   * сущностью и старые пороги останутся.
   */
  update: (id: string, data: UpdateTestTypeDto) =>
    api.patch<TestType>(`/test-types/${id}`, data),

  /**
   * DELETE /test-types/:id
   * 409 Conflict, если на тип есть ссылки в результатах.
   */
  delete: (id: string) =>
    api.delete<void>(`/test-types/${id}`),
};

// ==== Test Grades API ====
//
// Все маршруты вложены в ресурс типа теста:
//   /test-types/:testTypeId/grades[/:gradeId]
//
// testTypeId — обязательный параметр всех методов, потому что
// градация без типа теста не существует. Бэк гарантирует, что
// gradeId принадлежит указанному типу, иначе возвращает 404.
export const testGradeApi = {
  /**
   * Получить все градации типа теста.
   * GET /test-types/:testTypeId/grades → TestGrade[]
   *
   * Отсортированы по threshold (естественный порядок отображения).
   */
  getAllByTestType: (testTypeId: string) =>
    api.get<TestGrade[]>(`/test-types/${testTypeId}/grades`),

  /**
   * Получить одну градацию по id.
   * GET /test-types/:testTypeId/grades/:gradeId → TestGrade
   *
   * Если gradeId принадлежит другому типу — вернётся 404.
   */
  getOne: (testTypeId: string, gradeId: string) =>
    api.get<TestGrade>(`/test-types/${testTypeId}/grades/${gradeId}`),

  /**
   * Создать одну градацию.
   * POST /test-types/:testTypeId/grades → TestGrade
   */
  create: (testTypeId: string, data: CreateTestGradeDto) =>
    api.post<TestGrade>(`/test-types/${testTypeId}/grades`, data),

  /**
   * Обновить одну градацию (частично).
   * PATCH /test-types/:testTypeId/grades/:gradeId → TestGrade
   */
  update: (
    testTypeId: string,
    gradeId: string,
    data: UpdateTestGradeDto,
  ) =>
    api.patch<TestGrade>(
      `/test-types/${testTypeId}/grades/${gradeId}`,
      data,
    ),

  /**
   * Удалить одну градацию.
   * DELETE /test-types/:testTypeId/grades/:gradeId
   */
  remove: (testTypeId: string, gradeId: string) =>
    api.delete<void>(`/test-types/${testTypeId}/grades/${gradeId}`),

  /**
   * Применить diff к набору градаций типа теста.
   * PATCH /test-types/:testTypeId/grades → TestGrade[]
   *
   * Основная операция редактора набора: атомарно применяет
   * create / update / delete (порядок на бэке: delete → update → create)
   * и возвращает актуальный набор целиком.
   *
   * Возвращённые TestGrade содержат новые id для созданных градаций —
   * используй их как новый source of truth после сохранения.
   */
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
  /**
   * Получить всех пользователей лагеря с их номерами bib
   * GET /camps/:campId/users → CampUserDto[]
   */
  getByCamp: (campId: string) =>
    api.get<CampUserDto[]>(`/camps/${campId}/users`),

  /**
   * Добавить одного пользователя в лагерь
   * POST /camps/:campId/users → тело { userId } → CampUserDto
   */
  addOne: (campId: string, userId: string) =>
    api.post<CampUserDto>(`/camps/${campId}/users`, { userId }),

  /**
   * Массовое добавление пользователей в лагерь
   * POST /camps/:campId/users/bulk → тело { userIds } → CampUserDto[]
   */
  bulkAdd: (campId: string, userIds: string[]) =>
    api.post<CampUserDto[]>(`/camps/${campId}/users/bulk`, { userIds }),

  /**
   * Получить одного пользователя лагеря с bib
   * GET /camps/:campId/users/:userId → CampUserDto
   */
  getOne: (campId: string, userId: string) =>
    api.get<CampUserDto>(`/camps/${campId}/users/${userId}`),

  /**
   * Обновить номер bib пользователя в лагере
   * PATCH /camps/:campId/users/:userId/bib → тело { bib } → CampUserDto
   */
  updateBib: (campId: string, userId: string, bib: number) =>
    api.patch<CampUserDto>(`/camps/${campId}/users/${userId}/bib`, { bib }),

  /**
   * Удалить одного пользователя из лагеря
   * DELETE /camps/:campId/users/:userId
   */
  removeOne: (campId: string, userId: string) =>
    api.delete<void>(`/camps/${campId}/users/${userId}`),

  /**
   * Массовое удаление пользователей из лагеря
   * DELETE /camps/:campId/users → тело { userIds }
   */
  bulkRemove: (campId: string, userIds: string[]) =>
    api.delete<void>(`/camps/${campId}/users`, { data: { userIds } }),

  /**
   * Очистить лагерь (удалить всех участников)
   * DELETE /camps/:campId
   */
  clearAll: (campId: string) =>
    api.delete<void>(`/camps/${campId}`),

  /**
   * Проверить существование пользователя в лагере
   * GET /camps/exists/:campId/:userId → { exists: boolean }
   */
  exists: (campId: string, userId: string) =>
    api.get<{ exists: boolean }>(`/camps/exists/${campId}/${userId}`),

  /**
   * Получить все участия пользователя (список лагерей с bib)
   * GET /users/:userId/participations → CampParticipationDto[]
   */
  getUserParticipations: (userId: string) =>
    api.get<CampParticipationDto[]>(`/users/${userId}/participations`),
};

// ============================================================
//  РЕЗУЛЬТАТЫ ТЕСТОВ (RESULTS)
// ============================================================
//
// Контроллер: /results. Все маршруты требуют JWT (JwtAuthGuard).
//
// Ключевая идея: результат идентифицируется СУРРОГАТНЫМ UUID (`id`).
// В одном слоте (userId, campId, isTen, legNumber) может быть
// НЕСКОЛЬКО результатов — по одному на каждый уникальный набор
// `testTypeIds`. Пример: под тестом A и под тестом B в одном
// слоте — это две независимые строки results.
//
// Upsert-логика на бэке:
//   1. Ищется результат в слоте, у которого пересекается набор
//      `testTypeIds` с отправляемым.
//   2. Нашли → обновляем метрики + перепривязываем связи.
//   3. Не нашли → создаём новую строку с новым id.
//
// `testTypeIds` — массив UUID типов тестов, по которым оценивается
// результат (обычно 1–2, например женский + мужской норматив).
// ============================================================
export const resultApi = {
  /**
   * POST /results/training-camps/:campId
   * Массовый upsert результатов всех пользователей лагеря.
   *
   * campId передаётся в path — если он же дублируется в теле
   * (upload-results.dto.trainingCampId), бэк использует path.
   */
  uploadBulk: (campId: string, body: UploadResultsDto) =>
    api.post<Result[]>(`/results/training-camps/${campId}`, body),

  /**
   * POST /results/training-camps/:campId/users/:userId
   * Upsert результатов одного пользователя в лагере.
   *
   * Основной метод для формы «Добавить результат»:
   * если в слоте (userId, campId, isTen, legNumber) уже есть
   * результат с пересекающимся набором `testTypeIds` — обновится,
   * иначе создастся новый.
   */
  upsertUserResults: (
    userId: string,
    campId: string,
    body: CreateResultsDto,
  ) =>
    api.post<Result[]>(
      `/results/training-camps/${campId}/users/${userId}`,
      body,
    ),

  /**
   * GET /results/types/:testTypeId/training-camps/:campId
   * Все результаты всех пользователей лагеря по конкретному типу теста.
   * Лимит на бэке — 10000, пагинация не предусмотрена.
   */
  getAllByCampAndType: (testTypeId: string, campId: string) =>
    api.get<Result[]>(
      `/results/types/${testTypeId}/training-camps/${campId}`,
    ),

  /**
   * GET /results/types/:testTypeId
   * Глобальный поиск с фильтрацией, сортировкой и пагинацией.
   *
   * `testTypeId` обязателен и передаётся в path; все остальные
   * фильтры — в query (см. GetResultsQuery).
   */
  getAllByTestType: (testTypeId: string, params?: GetResultsQuery) =>
    api.get<PaginatedResponse<Result>>(`/results/types/${testTypeId}`, {
      params,
    }),

  /**
   * GET /results/:id
   * Получить результат по суррогатному UUID.
   */
  getById: (id: string) =>
    api.get<Result>(`/results/${id}`),

  /**
   * GET /results/composite/:userId/:campId/:isTen/:legNumber
   * Получить ВСЕ результаты в слоте (user, camp, is_10m, leg).
   *
   * Возвращает МАССИВ: в одном слоте может быть несколько
   * результатов — по одному на каждый уникальный набор `testTypeIds`.
   *
   * isTen в URL — строка 'true' | 'false' (boolean-параметр Nest
   * сериализует именно так при передаче в path).
   */
  getAllByComposite: (
    userId: string,
    campId: string,
    isTen: boolean,
    legNumber: number,
  ) =>
    api.get<Result[]>(
      `/results/composite/${userId}/${campId}/${isTen}/${legNumber}`,
    ),

  /**
   * PATCH /results/:id
   * Частичное обновление по суррогатному UUID.
   *
   * Отсутствующее поле = «не трогай». Явный `null` у метрик
   * (time / level / segments) = «очистить».
   *
   * Обновление возможно ТОЛЬКО по id: в одном слоте может быть
   * несколько результатов, и «обновить по composite» неоднозначно.
   */
  update: (id: string, data: UpdateResultDto) =>
    api.patch<Result>(`/results/${id}`, data),

  /**
   * DELETE /results/:id
   * Удалить один результат по суррогатному UUID.
   *
   * Название `remove` (а не `delete`) — потому что `delete` это
   * зарезервированное слово JS, использовать его как имя метода
   * в объекте неудобно. В коде вызывается как `resultApi.remove(id)`.
   */
  remove: (id: string) =>
    api.delete<void>(`/results/${id}`),

  /**
   * DELETE /results/composite/:userId/:campId/:isTen/:legNumber
   * Удалить ВСЕ результаты в слоте (user, camp, is_10m, leg) вместе
   * с их связями в result_test_types.
   *
   * Используется, когда нужно вычистить слот целиком, независимо
   * от того, сколько там результатов и к каким типам тестов они
   * привязаны.
   */
  removeAllByComposite: (
    userId: string,
    campId: string,
    isTen: boolean,
    legNumber: number,
  ) =>
    api.delete<void>(
      `/results/composite/${userId}/${campId}/${isTen}/${legNumber}`,
    ),

  /**
   * DELETE /results/types/:testTypeId/training-camps/:campId/users/:userId
   * Удалить ВСЕ результаты пользователя в лагере по конкретному типу теста.
   *
   * Полезно при массовой перезаливке: сначала чистим, потом upsert'им.
   */
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

// OAuth tokens stay on the backend; the frontend receives only the authorization URL.
export const oauthApi = {
  /**
   * GET /oauth/status
   * Возвращает актуальный статус связки Polar:
   *   - connected: boolean | null  (null = «неизвестно»);
   *   - reason: 'connected' | 'consents_required'
   *           | 'not_registered' | 'not_linked' | 'unknown'.
   *
   * Бэкенд при каждом вызове пингует Polar /v3/users/{polar-user-id},
   * так что страница «Связанные аккаунты» всегда видит реальное
   * состояние, а не кэш из БД.
   */
  status: () =>
    api.get<PolarStatusResponse>('/oauth/status'),

  /**
   * GET /oauth/connect
   * Получить URL для OAuth-авторизации Polar.
   * Всегда client_type=web — попап во фронте.
   */
  connect: (provider: 'polar') =>
    api.get<{ url: string }>('/oauth/connect', {
      params: { provider, client_type: 'web' },
    }),

  /**
   * POST /oauth/disconnect
   * Полный сброс связки Polar для текущего пользователя:
   *   1. DELETE /v3/users/{polar-user-id} на стороне Polar
   *      (best-effort: ошибки 403/404 не считаются провалом);
   *   2. очистка локальных токенов (oauthTokenService.revokeToken).
   *
   * Используется кнопкой «Сбросить и подключить заново» в UI,
   * чтобы после сброса пользователь прошёл OAuth-флоу заново
   * и Polar снова показал экран согласий.
   */
  disconnect: () =>
    api.post<{ ok: boolean }>('/oauth/disconnect'),
};

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

export default api;
