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