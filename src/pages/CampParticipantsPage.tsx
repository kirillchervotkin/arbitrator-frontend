import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  TextField,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Tooltip,
  Checkbox,
  Backdrop,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  FormControlLabel,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  ClearAll as ClearAllIcon,
  PersonAdd as PersonAddIcon,
  GroupAdd as GroupAddIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campParticipantApi, userApi, listApi } from '../services/api';
import { CampUserDto, User } from '../types';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';

export default function CampParticipantsPage() {
  const { campId } = useParams<{ campId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ===== Состояния =====
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [addOneDialogOpen, setAddOneDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [listUsers, setListUsers] = useState<User[]>([]);
  const [selectedListUserIds, setSelectedListUserIds] = useState<Set<string>>(new Set());
  const [isLoadingListUsers, setIsLoadingListUsers] = useState(false);

  // ===== Запросы =====
  const {
    data: participants = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<CampUserDto[]>({
    queryKey: ['participants', campId],
    queryFn: () => campParticipantApi.getByCamp(campId!).then((res) => res.data),
    enabled: !!campId,
  });

  const { data: listsData } = useQuery({
    queryKey: ['lists-all'],
    queryFn: () => listApi.getLists().then((res) => res.data),
    enabled: bulkAddDialogOpen,
    staleTime: 5 * 60 * 1000,
  });

  const availableLists = useMemo(() => listsData || [], [listsData]);

  // ===== Debounce =====
  const debouncedSearchRef = useRef(
    debounce(async (query: string) => {
      if (!query || query.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      try {
        const response = await userApi.getUsers({
          lastName: query,
          limit: 20,
          offset: 0,
        });
        setSearchResults(response.data.rows);
      } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300)
  );

  useEffect(() => {
    const currentDebounce = debouncedSearchRef.current;
    return () => {
      currentDebounce.cancel();
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setIsSearching(true);
    debouncedSearchRef.current(value);
  };

  // ===== Загрузка пользователей списка =====
  const handleListSelect = async (listId: string) => {
    setSelectedListId(listId);
    if (!listId) {
      setListUsers([]);
      setSelectedListUserIds(new Set());
      return;
    }
    setIsLoadingListUsers(true);
    try {
      const response = await listApi.getUserListsForList(listId);
      const users = response.data;
      setListUsers(users);
      setSelectedListUserIds(new Set(users.map((u) => u.id)));
    } catch (error) {
      console.error('Ошибка загрузки пользователей списка:', error);
      setSnackbar({ open: true, message: 'Не удалось загрузить пользователей списка', severity: 'error' });
    } finally {
      setIsLoadingListUsers(false);
    }
  };

  // ===== Мутации =====
  const addOneMutation = useMutation({
    mutationFn: () => {
      if (!selectedUser) throw new Error('Пользователь не выбран');
      return campParticipantApi.addOne(campId!, selectedUser.id);
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Участник добавлен', severity: 'success' });
      setAddOneDialogOpen(false);
      setSelectedUser(null);
      setSearchResults([]);
      queryClient.invalidateQueries({ queryKey: ['participants', campId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка добавления';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: () => {
      const userIds = Array.from(selectedListUserIds);
      if (userIds.length === 0) throw new Error('Не выбрано ни одного пользователя');
      return campParticipantApi.bulkAdd(campId!, userIds);
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Участники добавлены', severity: 'success' });
      setBulkAddDialogOpen(false);
      setSelectedListId('');
      setListUsers([]);
      setSelectedListUserIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['participants', campId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка массового добавления';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const updateBibMutation = useMutation({
    mutationFn: ({ userId, bib }: { userId: string; bib: number }) =>
      campParticipantApi.updateBib(campId!, userId, bib),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Номер bib обновлён', severity: 'success' });
      setEditBibDialogOpen(false);
      setEditingParticipant(null);
      queryClient.invalidateQueries({ queryKey: ['participants', campId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка обновления bib';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const deleteSingleMutation = useMutation({
    mutationFn: (userId: string) => campParticipantApi.removeOne(campId!, userId),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Участник удалён', severity: 'success' });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['participants', campId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка удаления';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const deleteMultipleMutation = useMutation({
    mutationFn: () => {
      const ids = Array.from(selectedUsers);
      return campParticipantApi.bulkRemove(campId!, ids);
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Участники удалены', severity: 'success' });
      setSelectedUsers(new Set());
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['participants', campId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка удаления';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => campParticipantApi.clearAll(campId!),
    onSuccess: () => {
      setSnackbar({ open: true, message: 'Лагерь очищен', severity: 'success' });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['participants', campId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof AxiosError ? err.response?.data?.message : 'Ошибка очистки';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  // ===== Состояния для редактирования bib =====
  const [editBibDialogOpen, setEditBibDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<CampUserDto | null>(null);
  const [newBib, setNewBib] = useState<number>(1);

  // ===== Состояния для подтверждения удаления =====
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'multiple' | 'all'; userId?: string } | null>(
    null,
  );

  // ===== Обработчики =====
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(participants.map((p) => p.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectOne = (userId: string, checked: boolean) => {
    const newSet = new Set(selectedUsers);
    if (checked) newSet.add(userId);
    else newSet.delete(userId);
    setSelectedUsers(newSet);
  };

  const handleEditBib = (participant: CampUserDto) => {
    setEditingParticipant(participant);
    setNewBib(participant.bib);
    setEditBibDialogOpen(true);
  };

  const handleDeleteSingle = (userId: string) => {
    setDeleteTarget({ type: 'single', userId });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteSelected = () => {
    if (selectedUsers.size === 0) return;
    setDeleteTarget({ type: 'multiple' });
    setDeleteConfirmOpen(true);
  };

  const handleClearAll = () => {
    setDeleteTarget({ type: 'all' });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'single' && deleteTarget.userId) {
      deleteSingleMutation.mutate(deleteTarget.userId);
    } else if (deleteTarget.type === 'multiple') {
      deleteMultipleMutation.mutate();
    } else if (deleteTarget.type === 'all') {
      clearAllMutation.mutate();
    }
  };

  const handleAddOne = () => {
    if (!selectedUser) return;
    addOneMutation.mutate();
  };

  const handleBulkAdd = () => {
    if (selectedListUserIds.size === 0) {
      setSnackbar({ open: true, message: 'Выберите хотя бы одного пользователя', severity: 'error' });
      return;
    }
    bulkAddMutation.mutate();
  };

  const toggleListUser = (userId: string) => {
    const newSet = new Set(selectedListUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedListUserIds(newSet);
  };

  const toggleAllListUsers = (checked: boolean) => {
    if (checked) {
      setSelectedListUserIds(new Set(listUsers.map((u) => u.id)));
    } else {
      setSelectedListUserIds(new Set());
    }
  };

  // ===== Рендер =====
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate('/training-camps')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 600, ml: 1 }}>
          Участники лагеря
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setAddOneDialogOpen(true)}>
          Добавить одного
        </Button>
        <Button variant="contained" startIcon={<GroupAddIcon />} onClick={() => setBulkAddDialogOpen(true)}>
          Добавить из списка
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleDeleteSelected}
          disabled={selectedUsers.size === 0}
        >
          Удалить выбранных ({selectedUsers.size})
        </Button>
        <Button variant="outlined" color="error" startIcon={<ClearAllIcon />} onClick={handleClearAll}>
          Очистить лагерь
        </Button>
        <Button
          variant="contained"
          onClick={() => refetch()}
          disabled={isFetching}
          startIcon={isFetching ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
        >
          Обновить
        </Button>
      </Paper>

      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {(error as Error)?.message || 'Не удалось загрузить участников'}
          </Alert>
        ) : participants.length === 0 && !isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              В этом лагере пока нет участников
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedUsers.size > 0 && selectedUsers.size < participants.length}
                        checked={participants.length > 0 && selectedUsers.size === participants.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>Имя</TableCell>
                    <TableCell>Фамилия</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell align="center">Номер (bib)</TableCell>
                    <TableCell align="center">Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUsers.has(p.id)}
                          onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{p.firstName}</TableCell>
                      <TableCell>{p.lastName}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Изменить номер">
                          <Button size="small" variant="outlined" onClick={() => handleEditBib(p)}>
                            {p.bib}
                          </Button>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Удалить">
                          <IconButton size="small" color="error" onClick={() => handleDeleteSingle(p.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Backdrop
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
                color: '#fff',
                backgroundColor: 'rgba(255,255,255,0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              open={isLoading || isFetching}
            >
              <CircularProgress />
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                Загрузка данных...
              </Typography>
            </Backdrop>
          </>
        )}
      </Paper>

      {/* ===== Диалог добавления одного участника ===== */}
      <Dialog open={addOneDialogOpen} onClose={() => setAddOneDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить участника</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={searchResults}
            getOptionLabel={(option) =>
              `${option.lastName} ${option.firstName} (${option.email})`
            }
            loading={isSearching}
            value={selectedUser}
            onChange={(_, newValue) => setSelectedUser(newValue)}
            onInputChange={(_, newInputValue) => handleSearchChange(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Поиск по фамилии"
                fullWidth
                margin="dense"
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps?.input,
                    endAdornment: isSearching ? <CircularProgress size={20} /> : null,
                  },
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box>
                  <Typography variant="body1">
                    {option.lastName} {option.firstName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.email}
                  </Typography>
                </Box>
              </li>
            )}
            noOptionsText="Пользователи не найдены"
            freeSolo={false}
            disableClearable={false}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOneDialogOpen(false)} disabled={addOneMutation.isPending}>
            Отмена
          </Button>
          <Button
            onClick={handleAddOne}
            variant="contained"
            disabled={!selectedUser || addOneMutation.isPending}
          >
            {addOneMutation.isPending ? <CircularProgress size={24} /> : 'Добавить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Диалог массового добавления ===== */}
      <Dialog open={bulkAddDialogOpen} onClose={() => setBulkAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Добавление участников из списка</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Выберите список</InputLabel>
              <Select
                value={selectedListId}
                onChange={(e) => handleListSelect(e.target.value)}
                label="Выберите список"
                disabled={isLoadingListUsers || bulkAddMutation.isPending}
              >
                <MenuItem value="">
                  <em>Не выбран</em>
                </MenuItem>
                {availableLists.map((list) => (
                  <MenuItem key={list.id} value={list.id}>
                    {list.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedListId && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    Пользователи списка ({listUsers.length})
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={
                          listUsers.length > 0 && selectedListUserIds.size === listUsers.length
                        }
                        indeterminate={
                          selectedListUserIds.size > 0 && selectedListUserIds.size < listUsers.length
                        }
                        onChange={(e) => toggleAllListUsers(e.target.checked)}
                        disabled={isLoadingListUsers || bulkAddMutation.isPending}
                      />
                    }
                    label="Выбрать всех"
                  />
                </Box>

                {isLoadingListUsers ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress />
                  </Box>
                ) : listUsers.length === 0 ? (
                  <Alert severity="info">В этом списке нет пользователей</Alert>
                ) : (
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                    <List dense>
                      {listUsers.map((user) => (
                        <ListItem key={user.id} divider>
                          <Checkbox
                            checked={selectedListUserIds.has(user.id)}
                            onChange={() => toggleListUser(user.id)}
                            disabled={bulkAddMutation.isPending}
                          />
                          <ListItemText
                            primary={`${user.lastName} ${user.firstName}`}
                            secondary={user.email}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}

                <Alert severity="info">
                  Выбрано пользователей: <strong>{selectedListUserIds.size}</strong>
                </Alert>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkAddDialogOpen(false)} disabled={bulkAddMutation.isPending}>
            Отмена
          </Button>
          <Button
            onClick={handleBulkAdd}
            variant="contained"
            disabled={
              !selectedListId ||
              selectedListUserIds.size === 0 ||
              isLoadingListUsers ||
              bulkAddMutation.isPending
            }
          >
            {bulkAddMutation.isPending ? <CircularProgress size={24} /> : 'Добавить выбранных'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Диалог изменения bib ===== */}
      <Dialog open={editBibDialogOpen} onClose={() => setEditBibDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Изменение номера bib</DialogTitle>
        <DialogContent>
          <TextField
            label="Новый номер"
            type="number"
            value={newBib}
            onChange={(e) => setNewBib(Number(e.target.value))}
            fullWidth
            margin="dense"
            disabled={updateBibMutation.isPending}
            slotProps={{
              htmlInput: {
                min: 1,
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditBibDialogOpen(false)} disabled={updateBibMutation.isPending}>
            Отмена
          </Button>
          <Button
            onClick={() => updateBibMutation.mutate({ userId: editingParticipant!.id, bib: newBib })}
            variant="contained"
            disabled={newBib < 1 || updateBibMutation.isPending}
          >
            {updateBibMutation.isPending ? <CircularProgress size={24} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Диалог подтверждения удаления ===== */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            {deleteTarget?.type === 'single' && 'Вы уверены, что хотите удалить этого участника?'}
            {deleteTarget?.type === 'multiple' &&
              `Вы уверены, что хотите удалить выбранных участников (${selectedUsers.size})?`}
            {deleteTarget?.type === 'all' &&
              'Вы уверены, что хотите удалить ВСЕХ участников лагеря? Это действие необратимо.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={deleteSingleMutation.isPending || deleteMultipleMutation.isPending || clearAllMutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleteSingleMutation.isPending || deleteMultipleMutation.isPending || clearAllMutation.isPending}
          >
            {deleteSingleMutation.isPending || deleteMultipleMutation.isPending || clearAllMutation.isPending ? (
              <CircularProgress size={24} />
            ) : (
              'Удалить'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Snackbar ===== */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
