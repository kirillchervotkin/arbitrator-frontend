import TournamentsPage from './pages/TournamentsPage';
import TournamentPage from './pages/TournamentPage';
// ===== Календарь и судейство (новые страницы) =====
import CitiesPage from './pages/CitiesPage';
import TeamsPage from './pages/TeamsPage';
import FieldRolesPage from './pages/FieldRolesPage';
import MatchesPage from './pages/MatchesPage';
import MatchPage from './pages/MatchPage';
import AssignmentsPage from './pages/AssignmentsPage';

import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ConnectedAccountsPage from './pages/ConnectedAccountsPage';
import UsersPage from './pages/UsersPage';
import ListsPage from './pages/ListsPage';
import UsersManagementPage from './pages/UsersManagementPage';
import StandardsReportPage from './pages/StandardsReportPage';
import QuestionnairesListPage from './pages/QuestionnairesListPage';
import QuestionnaireDetailPage from './pages/QuestionnaireDetailPage';
// Импорт страниц тренировочных лагерей
import TrainingCampsPage from './pages/TrainingCampsPage';
import CampParticipantsPage from './pages/CampParticipantsPage';
// Импорт страницы типов тестов
import TestTypesPage from './pages/TestTypesPage';
// Импорт страницы градаций тестов
import TestGradesPage from './pages/TestGradesPage';
// Импорт страницы результатов тестов
import ResultsPage from './pages/ResultsPage';
// Импорт страниц тренировок
import TrainingSessionsPage from './pages/TrainingSessionsPage';
import TrainingSessionPage from './pages/TrainingSessionPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ===== Календарь: турниры ===== */}
        <Route
          path="/tournaments"
          element={
            <ProtectedRoute>
              <Navbar>
                <TournamentsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tournaments/:id"
          element={
            <ProtectedRoute>
              <Navbar>
                <TournamentPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* ===== Справочники календаря ===== */}
        <Route
          path="/cities"
          element={
            <ProtectedRoute>
              <Navbar>
                <CitiesPage />
              </Navbar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute>
              <Navbar>
                <TeamsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/field-roles"
          element={
            <ProtectedRoute>
              <Navbar>
                <FieldRolesPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* ===== Матчи ===== */}
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Navbar>
                <MatchesPage />
              </Navbar>
            </ProtectedRoute>
          }
        />
        <Route
          path="/matches/:matchId"
          element={
            <ProtectedRoute>
              <Navbar>
                <MatchPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* ===== Назначения (отчёты) ===== */}
        <Route
          path="/assignments"
          element={
            <ProtectedRoute>
              <Navbar>
                <AssignmentsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* ===== Авторизация ===== */}
        <Route path="/login" element={<Login />} />

        {/* ===== Прочее ===== */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navbar>
                <Dashboard />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/connected-accounts"
          element={
            <ProtectedRoute>
              <Navbar>
                <ConnectedAccountsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Navbar>
                <UsersPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lists"
          element={
            <ProtectedRoute>
              <Navbar>
                <ListsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lists/:listId/users"
          element={
            <ProtectedRoute>
              <Navbar>
                <UsersManagementPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/standards-report"
          element={
            <ProtectedRoute>
              <Navbar>
                <StandardsReportPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/questionnaires"
          element={
            <ProtectedRoute>
              <Navbar>
                <QuestionnairesListPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/questionnaires/:userId"
          element={
            <ProtectedRoute>
              <Navbar>
                <QuestionnaireDetailPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* Маршруты тренировочных лагерей */}
        <Route
          path="/training-camps"
          element={
            <ProtectedRoute>
              <Navbar>
                <TrainingCampsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training-camps/:campId/participants"
          element={
            <ProtectedRoute>
              <Navbar>
                <CampParticipantsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* Маршруты тренировок */}
        <Route
          path="/training-sessions"
          element={
            <ProtectedRoute>
              <Navbar>
                <TrainingSessionsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training-sessions/:provider/:externalId"
          element={
            <ProtectedRoute>
              <Navbar>
                <TrainingSessionPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* Маршрут типов тестов */}
        <Route
          path="/test-types"
          element={
            <ProtectedRoute>
              <Navbar>
                <TestTypesPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* Маршрут градаций типа теста */}
        <Route
          path="/test-types/:testTypeId/grades"
          element={
            <ProtectedRoute>
              <Navbar>
                <TestGradesPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        {/* Маршрут управления результатами тестов */}
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <Navbar>
                <ResultsPage />
              </Navbar>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;