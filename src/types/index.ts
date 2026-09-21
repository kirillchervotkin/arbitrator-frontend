// src/types.ts

// ===== Пользователь =====
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string; // ISO-строка
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Данные для создания нового пользователя
export interface CreateUserData {
  email: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  isActive?: boolean;
}

// Данные для обновления пользователя
export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  birthDate?: Date;
  isActive?: boolean;
}

// ===== Авторизация =====
export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  activationCode: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  birthDate?: Date;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

// ===== OAuth / Связанные аккаунты =====
/**
 * Причина, по которой связка с Polar отсутствует или неактивна.
 * Соответствует `PolarUserStatus` на бэкенде + локальные состояния.
 *
 * - connected         — зарегистрирован в Polar, согласия приняты;
 * - consents_required — зарегистрирован, но обязательные согласия
 *                       не приняты или отозваны (403 от /v3/users);
 * - not_registered    — Polar не знает пользователя (204/401);
 * - not_linked        — у нас нет сохранённого access token;
 * - unknown           — не удалось определить (сеть/5xx).
 */
export type PolarStatusReason =
  | 'connected'
  | 'consents_required'
  | 'not_registered'
  | 'not_linked'
  | 'unknown';

/**
 * Ответ `GET /oauth/status`.
 * `connected === null` означает «неизвестно» (см. reason === 'unknown').
 */
export interface PolarStatusResponse {
  polar: {
    connected: boolean | null;
    reason: PolarStatusReason;
  };
}

/**
 * Коды ошибок, которые бэкенд прокидывает во фронт через
 * `window.opener.postMessage({ type: 'OAUTH_CONNECT', success, error })`.
 */
export type OAuthErrorCode =
  | 'invalid_state'
  | 'authorization_declined'
  | 'consents_required'
  | 'already_linked'
  | 'unsupported_client_type'
  | 'connection_failed';

/**
 * Разобранный результат OAuth-попапа.
 * Возвращается `readOAuthResult` из `utils/oauth`.
 */
export interface OAuthResult {
  success: boolean;
  error: OAuthErrorCode | null;
}

// ===== Список (List) =====
export interface List {
  id: string;
  name: string;
  active: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListDto {
  name: string;
  active?: boolean;
  description?: string;
}

export interface UpdateListDto {
  name?: string;
  active?: boolean;
  description?: string;
}

// ===== Связь Пользователь-Список =====
export interface AssignListDto {
  listId: string;
}

export interface UnassignListParamsDto {
  userId: string;
  listId: string;
}

export interface UserListResponseDto {
  userId: string;
  listId: string;
  assignedAt: string;
}

export interface UserListRelation {
  id: string;
  userId: string;
  listId: string;
  username: string;
  assignedAt: string;
}

// ===== Ошибки валидации =====
export interface ValidParam {
  name: string;
  value: unknown;
}

export interface InvalidParam {
  name: string;
  errors: Array<{
    reason: string;
    code?: string;
    source?: { pointer: string };
  }>;
}

// ============================================================
// ===== Типы тестов (ОБНОВЛЕНО) =====
// ============================================================

/**
 * Параметр оценки теста. Выводится на бэкенде из комбинации
 * заполненных порогов failThreshold*:
 *   - только failThresholdTime            → 'time'
 *   - только failThresholdSegments        → 'segments'
 *   - failThresholdLevel + failThresholdSegments → 'level'
 *
 * Клиент это поле НЕ отправляет — оно read-only в ответах API.
 */
export type TestParameter = 'time' | 'level' | 'segments';

export type Gender = 'male' | 'female';

/**
 * Полное представление типа теста (ответ API).
 * Соответствует TestTypeResponseDto на бэкенде.
 */
export interface TestType {
  id: string;
  name: string;
  gender: Gender;
  parameter: TestParameter;
  failThresholdTime: number | null;
  failThresholdLevel: number | null;
  failThresholdSegments: number | null;
  attemptsCount: number | null;
}

/**
 * Данные для создания типа теста.
 * Соответствует CreateTestTypeDto.
 *
 * `parameter` отсутствует намеренно — бэкенд выводит его из порогов.
 * `attemptsCount` обязателен и применим только при заданном `failThresholdTime`.
 */
export type CreateTestTypeDto = {
  name: string;
  gender: Gender;
} & (
  | {
      // time-тест
      failThresholdTime: number;
      attemptsCount: number;
      failThresholdLevel?: null;
      failThresholdSegments?: null;
    }
  | {
      // segments-тест
      failThresholdSegments: number;
      failThresholdTime?: null;
      failThresholdLevel?: null;
      attemptsCount?: null;
    }
  | {
      // level-тест
      failThresholdLevel: number;
      failThresholdSegments: number;
      failThresholdTime?: null;
      attemptsCount?: null;
    }
);

/**
 * Данные для частичного обновления типа теста.
 * Соответствует UpdateTestTypeDto.
 *
 * Все поля опциональны. При изменении порогов рекомендуется передавать
 * весь набор для выбранного типа (например, level + segments вместе)
 * и явные `null` для снятия старых значений — иначе бэкенд сохранит
 * прежние пороги при merge с текущей сущностью.
 */
export interface UpdateTestTypeDto {
  name?: string;
  gender?: Gender;
  failThresholdTime?: number | null;
  failThresholdLevel?: number | null;
  failThresholdSegments?: number | null;
  attemptsCount?: number | null;
}

/** Параметры запроса списка типов тестов */
export interface GetTestTypesQuery {
  limit?: number;
  offset?: number;
  name?: string;
  gender?: Gender;
  orderBy?: 'name' | 'id' | 'gender';
  orderDir?: 'ASC' | 'DESC';
}

// ===== Градации тестов =====
export interface TestGrade {
  id: string;
  testTypeId: string;
  grade: string;
  threshold: number;
  color: string; // HEX, например "#4CAF50"
}

export interface CreateTestGradeDto {
  grade: string;
  threshold: number;
  color: string;
}

export interface UpdateTestGradeDto {
  grade?: string;
  threshold?: number;
  color?: string;
}

export type ApplyDiffCreateItem = CreateTestGradeDto;

export interface ApplyDiffUpdateItem extends UpdateTestGradeDto {
  id: string;
}

export interface ApplyTestGradeDiffDto {
  create?: ApplyDiffCreateItem[];
  update?: ApplyDiffUpdateItem[];
  delete?: string[];
}

// ===== Тренировочные лагеря =====
export interface TrainingCamp {
  id: string;
  name: string;
  description?: string | null;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  location?: string | null;
  isActive: boolean;
}

export type CreateTrainingCampDto = Omit<TrainingCamp, 'id'>;

export interface UpdateTrainingCampDto {
  id: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  isActive?: boolean;
}

// ===== Участники тренировочного лагеря =====
export interface CampParticipant {
  campId: string;
  userId: string;
  bib: number;
}

export interface CampUserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  bib: number;
}

export interface CampParticipationDto {
  campId: string;
  bib: number;
}

export interface CreateCampParticipantDto {
  userId: string;
}

export interface BulkAddParticipantsDto {
  userIds: string[];
}

export interface BulkRemoveParticipantsDto {
  userIds: string[];
}

export interface UpdateBibDto {
  bib: number;
}

// ===== Общий интерфейс для пагинированных ответов =====
export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
}

// ===== Отчёт по нормативам =====
export interface StandardsReportItem {
  lastName: string;
  firstName: string;
  times: (number | null)[];
  times10m: (number | null)[];
  sex?: string;
}

// ===== Анкеты (Questionnaires) =====
export interface Questionnaire {
  userId: string;
  sportsCategory: string | null;
  orderNumber: string | null;
  assignmentDate: string | null;
  assigningAuthority: string | null;
  isFifaJudge: boolean | null;
  fifaId: string | null;
  hasVarLicense: boolean | null;
  heightCm: number | null;
  jogelEquipmentSize: string | null;
  jogelShoeSize: number | null;
  citizenship: string | null;
  countryOfResidence: string | null;
  passportType: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  issuedBy: string | null;
  issueDate: string | null;
  departmentCode: string | null;
  phone: string | null;
}

export interface QuestionnaireWithUser extends Questionnaire {
  firstName: string;
  lastName: string;
  email: string | null;
}

export type CreateQuestionnaireData = {
  userId: string;
} & Partial<Omit<Questionnaire, 'userId'>>;

export type UpdateQuestionnaireData = Partial<Omit<CreateQuestionnaireData, 'userId'>> & {
  userId: string;
};

export type CreateQuestionnaireByEmail = {
  email: string;
} & Omit<CreateQuestionnaireData, 'userId'>;

export interface GetQuestionnairesQuery {
  listIds?: string[];
  userIds?: string[];
  limit?: number;
  offset?: number;
}

// ============================================================
// ===== Результаты тестов (Results) =====
// ============================================================

/**
 * Допустимые статусы результата.
 * - completed     — зачтён;
 * - not_credited  — выполнен, но не зачтён (техническая ошибка / помешал соперник);
 * - not_admitted  — спортсмен не допущен к тесту.
 *
 * Хранится как const-массив, чтобы можно было использовать и как
 * тип (`ResultStatus`), и как runtime-значение (например, для
 * рендера селектов в формах).
 */
export const RESULT_STATUSES = ['completed', 'not_credited', 'not_admitted'] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

/**
 * Полное представление результата (ответ API).
 * Соответствует `ResultResponseDto` на бэкенде.
 */
export interface Result {
  /** Суррогатный UUID результата */
  id: string;
  userId: string;
  trainingCampId: string;
  /** true – забег на 10 м, false – основной */
  isTen: boolean;
  /** Номер забега (1, 2 или 3) */
  legNumber: number;
  status: ResultStatus;
  /** Время в секундах (для обычных тестов) */
  time: number | null;
  /** Уровень (для теста «уровень + отрезки») */
  level: number | null;
  /** Количество отрезков (для тестов с отрезками) */
  segments: number | null;
  /** UUID типов тестов, привязанных к результату */
  testTypeIds: string[];
}

/**
 * Один элемент результата в теле запроса (забег).
 * Соответствует `CreateResultItemDto`.
 *
 * Валидатор бэкенда разрешает передавать любое подмножество
 * метрик (`time` / `level` / `segments`), но требует, чтобы при
 * `status === 'not_admitted'` метрики были пустыми, а при остальных
 * статусах — заполнена хотя бы одна.
 */
export interface CreateResultItemDto {
  isTen: boolean;
  /** Номер забега (1..3) */
  legNumber: number;
  status?: ResultStatus;
  time?: number | null;
  level?: number | null;
  segments?: number | null;
}

/**
 * Результаты одного пользователя (используется в массовом upsert).
 * Соответствует `UserResultsDto`.
 */
export interface UserResultsDto {
  userId: string;
  items: CreateResultItemDto[];
}

/**
 * Body для `POST /results/training-camps/:campId/users/:userId`
 * (upsert результатов одного пользователя).
 * Соответствует `CreateResultsDto`.
 */
export interface CreateResultsDto {
  items: CreateResultItemDto[];
  testTypeIds: string[];
}

/**
 * Body для `POST /results/training-camps/:campId`
 * (массовый upsert всех пользователей сбора).
 * Соответствует `UploadResultsDto`.
 */
export interface UploadResultsDto {
  /** Опционально, если campId уже указан в path */
  trainingCampId?: string;
  users: UserResultsDto[];
  testTypeIds: string[];
}

/**
 * Body для `PATCH /results/:id` и `PATCH /results/composite/...`.
 * Соответствует `UpdateResultDto`.
 *
 * Все поля опциональны. Отсутствующее поле = «не трогай»;
 * явный `null` у метрик = «очистить».
 */
export interface UpdateResultDto {
  status?: ResultStatus;
  time?: number | null;
  level?: number | null;
  segments?: number | null;
}

/**
 * Query-параметры для `GET /results/types/:testTypeId`.
 * `testTypeId` передаётся в path, остальные — в query.
 */
export interface GetResultsQuery {
  limit?: number;
  offset?: number;
  userId?: string;
  trainingCampId?: string;
  /** true – 10 м, false – основной */
  isTen?: boolean;
  legNumber?: number;
  status?: ResultStatus;
  orderBy?: 'time' | 'legNumber';
  orderDir?: 'ASC' | 'DESC';
}

// ============================================================
// ===== Тренировки (Training Sessions) =====
// ============================================================

/** Ключи сэмплов — совпадают с SampleType на бэке */
export type SampleType =
  | 'hr'
  | 'speed'
  | 'power'
  | 'cadence'
  | 'altitude'
  | 'distance'
  | 'temperature';

/** Распакованный сэмпл одного типа (ответ getOne) */
export type ParsedSample = {
  intervalSec: number;
  values: number[];
};

/** Сырой блоб одного типа (ответ getRawSamples) */
export type RawSample = {
  intervalSec: number;
  /** base64, little-endian */
  samplesBase64: string;
};

/** Ответ GET /training-sessions/:provider/:externalId/raw-samples */
export type RawSamplesResponse = {
  sessionId: string;
  samples: Partial<Record<SampleType, RawSample>>;
};

/** Коды видов спорта — зеркало SPORT_CODES из update-training-session.dto.ts */
export type SportCode =
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'walking'
  | 'hiking'
  | 'strength'
  | 'cardio'
  | 'yoga'
  | 'rowing'
  | 'skiing'
  | 'skating'
  | 'tennis'
  | 'football'
  | 'basketball'
  | 'other';

/** Элемент списка (GET /training-sessions) */
export type TrainingSessionListItem = {
  id: string;
  provider: string;
  externalId: string;
  startTime: string; // ISO 8601
  durationSec: number;
  sport: SportCode | null;
  distanceM: number | null;
  calories: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrMin: number | null;
  ascentM: number | null;
  descentM: number | null;
  name: string | null;
  notes: string | null;
};

/** Одна тренировка с распакованными сэмплами (GET /training-sessions/:provider/:externalId) */
export type TrainingSessionWithSamples = TrainingSessionListItem & {
  samples: Partial<Record<SampleType, ParsedSample>>;
};

/** Ответ списка тренировок (GET /training-sessions) */
export type ListTrainingSessionsResponse = {
  sessions: TrainingSessionListItem[];
  sportTypes: Record<string, { ru: string; en: string }>;
};

/** Body для PATCH /training-sessions/:provider/:externalId */
export type UpdateTrainingSessionData = {
  name?: string | null;
  notes?: string | null;
  sport?: SportCode | null;
};

// ============================================================
// ===== Турниры (Tournaments) =====
// ============================================================
//
// Турнир — корневая сущность календаря. Тип определяет характер
// соревнования:
//   - LEAGUE     — регулярный чемпионат (Вторая лига А/Б);
//   - CUP        — кубок со стадиями и плей-офф (Кубок России);
//   - SUPER_CUP  — одноматчевый турнир.
//
// На фронте даты приходят как ISO-строки (NestJS сериализует Date
// в ISO автоматически).

export type TournamentType = 'LEAGUE' | 'CUP' | 'SUPER_CUP';

export interface Tournament {
  id: string;
  name: string;
  season: string;       // '2023/24'
  type: TournamentType;
  startDate: string | null;  // ISO 8601
  endDate: string | null;    // ISO 8601
  createdAt: string;
  updatedAt: string;
}

export interface CreateTournamentDto {
  name: string;
  season: string;
  type: TournamentType;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateTournamentDto {
  name?: string;
  season?: string;
  type?: TournamentType;
  startDate?: string | null;
  endDate?: string | null;
}

export interface FindTournamentsQuery {
  season?: string;
  type?: TournamentType;
  orderBy?: 'name' | 'season' | 'createdAt';
  orderDir?: 'ASC' | 'DESC';
}

// ============================================================
// ===== Этапы турнира (Stages) =====
// ============================================================
//
// Этап — узел дерева структуры турнира. Бывает:
//   - STAGE   — контейнер («Групповой этап»);
//   - GROUP   — группа (format = ROUND_ROBIN);
//   - ROUND   — раунд плей-офф (format = ELIMINATION);
//   - PLAYOFF — контейнер для плей-офф.
//
// `format` = null для контейнеров STAGE/PLAYOFF.
// `parentStageId` = null для корневых этапов.
// `settings` — гибкие параметры (очки, тай-брейки, правила обмена).

export type StageType = 'STAGE' | 'GROUP' | 'ROUND' | 'PLAYOFF';
export type StageFormat = 'ROUND_ROBIN' | 'ELIMINATION';

export interface Stage {
  id: string;
  tournamentId: string;
  parentStageId: string | null;
  name: string;
  type: StageType;
  format: StageFormat | null;
  sortOrder: number;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** Элемент дерева этапов (ответ GET /tournaments/:id/stages/tree) */
export interface StageTreeItem extends Stage {
  children: StageTreeItem[];
}

export interface CreateStageDto {
  name: string;
  type: StageType;
  format?: StageFormat | null;
  parentStageId?: string | null;
  sortOrder?: number;
  settings?: Record<string, unknown> | null;
}

export interface UpdateStageDto {
  name?: string;
  type?: StageType;
  format?: StageFormat | null;
  parentStageId?: string | null;
  sortOrder?: number;
  settings?: Record<string, unknown> | null;
}

export interface FindStagesQuery {
  type?: StageType;
  rootOnly?: boolean;
  parentStageId?: string;
}

// ============================================================
// ===== Города (Cities) =====
// ============================================================

export interface City {
  id: string;
  name: string;
  region: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCityDto {
  name: string;
  region?: string | null;
}

export interface UpdateCityDto {
  name?: string;
  region?: string | null;
}

export interface FindCitiesQuery {
  search?: string;    // частичный поиск по имени (автокомплит)
  region?: string;    // точное совпадение
  orderBy?: 'name' | 'region' | 'createdAt';
  orderDir?: 'ASC' | 'DESC';
}

// ============================================================
// ===== Команды (Teams) =====
// ============================================================

export interface Team {
  id: string;
  name: string;
  shortName: string | null;
  cityId: string | null;
}

export interface CreateTeamDto {
  name: string;
  shortName?: string | null;
  cityId?: string | null;
}

export interface UpdateTeamDto {
  name?: string;
  shortName?: string | null;
  cityId?: string | null;
}

export interface FindTeamsQuery {
  search?: string;      // частичный поиск по имени
  shortName?: string;   // частичный поиск по короткому имени
  cityId?: string;      // точное совпадение
  orderBy?: 'name' | 'shortName';
  orderDir?: 'ASC' | 'DESC';
}

// ============================================================
// ===== Матчи (Matches) =====
// ============================================================
//
// Матч всегда привязан к этапу через `stageId`. Этап определяет,
// круговой это матч (с туром) или плей-офф (без тура).
//
// `tourNumber` — номер тура (для ROUND_ROBIN). null для плей-офф.
// `homeTeamId` / `awayTeamId` — nullable. Для плей-офф создаются
//   без команд, заполняются позже.
// `homeScore` / `awayScore` — null, пока матч не сыгран.

export interface Match {
  id: string;
  tournamentId: string;
  stageId: string;
  tourNumber: number | null;
  matchDate: string;  // ISO 8601
  cityId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface CreateMatchDto {
  matchDate: string;
  cityId: string;
  tourNumber?: number | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
}

export interface UpdateMatchDto {
  matchDate?: string;
  cityId?: string;
  tourNumber?: number | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface FindMatchesQuery {
  tournamentId?: string;
  stageId?: string;
  cityId?: string;
  teamId?: string;
  tourNumber?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'matchDate' | 'tourNumber';
  orderDir?: 'ASC' | 'DESC';
}

// ============================================================
// ===== Роли на поле (Field Roles) =====
// ============================================================
//
// Справочник фиксированный (5 ролей): REFEREE, ASSISTANT, RESERVE,
// VAR, AVAR. `code` — ключ локализации на фронте, `name` —
// русский fallback, `sortOrder` — порядок отображения.

export interface FieldRole {
  id: string;
  code: string;      // 'REFEREE' | 'ASSISTANT' | 'RESERVE' | 'VAR' | 'AVAR'
  name: string;      // 'Главный судья'
  sortOrder: number;
}

export interface CreateFieldRoleDto {
  code: string;
  name: string;
  sortOrder: number;
}

export interface UpdateFieldRoleDto {
  code?: string;
  name?: string;
  sortOrder?: number;
}

export interface FindFieldRolesQuery {
  code?: string;
  name?: string;
  orderBy?: 'sortOrder' | 'code' | 'name';
  orderDir?: 'ASC' | 'DESC';
}

// ============================================================
// ===== Назначения (Assignments) =====
// ============================================================
//
// Назначение — связка «судья X на матч Y в роли Z».
// Бригада может быть неполной — «на матч должен быть REFEREE»
// не проверяется.
//
// Бэкенд при создании/обновлении проверяет (в одной транзакции):
//   1. Матч, судья, роль существуют;
//   2. Судья не назначен на этот матч дважды;
//   3. Судья не назначен на другой матч в тот же день.

export interface Assignment {
  id: string;
  matchId: string;
  userId: string;
  fieldRoleId: string;
}

export interface CreateAssignmentDto {
  userId: string;
  fieldRoleId: string;
}

export interface UpdateAssignmentDto {
  userId?: string;
  fieldRoleId?: string;
}

export interface FindAssignmentsQuery {
  matchId?: string;
  userId?: string;
  fieldRoleId?: string;
  dateFrom?: string;
  dateTo?: string;
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Назначение с деталями: ФИО судьи и данные роли.
 * Используется в ответе GET /matches/:id/crew.
 */
export interface AssignmentWithDetails {
  id: string;
  matchId: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  fieldRoleId: string;
  roleCode: string;
  roleName: string;
  roleSortOrder: number;
}

/**
 * Ответ GET /matches/:matchId/crew.
 * Матч + команды + город + этап + бригада одним объектом.
 */
export interface MatchCrew {
  matchId: string;
  matchDate: string;
  tourNumber: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  cityId: string;
  cityName: string;
  stageId: string;
  stageName: string;
  crew: AssignmentWithDetails[];
}