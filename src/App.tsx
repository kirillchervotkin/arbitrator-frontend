import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
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

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
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