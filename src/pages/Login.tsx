import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Backdrop,
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || 'Ошибка входа. Проверьте email и пароль.');
      } else {
        setError('Произошла неизвестная ошибка');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e8f0fe 0%, #d4e4f7 100%)',
        position: 'relative', // для корректного позиционирования Backdrop
      }}
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 400, width: '100%', borderRadius: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, textAlign: 'center' }}>
          Вход
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
          Введите email и пароль
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            disabled={loading}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            sx={{ mb: 3 }}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ py: 1.5, fontWeight: 600 }}
          >
            {loading ? 'Отправка...' : 'Войти'}
          </Button>
        </form>
      </Paper>

      {/* Оверлей с затемнением и спиннером */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Box>
  );
}