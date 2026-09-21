import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function CompetitionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      sx={{
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: 2,
        mb: 3,
      }}
    >
      <Box>
        <Typography
          variant="overline"
          color="primary"
          sx={{ fontWeight: 700, letterSpacing: 1.6 }}
        >
          Соревнования
        </Typography>
        <Typography
          component="h1"
          variant="h4"
          sx={{
            fontWeight: 750,
            fontSize: { xs: 28, md: 34 },
            letterSpacing: '-.7px',
          }}
        >
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, fontSize: 14 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

export function CompetitionSummary({
  items,
}: {
  items: { label: string; value: string | number }[];
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: { xs: 1, sm: 2 },
        mb: 3,
      }}
    >
      {items.map((item) => (
        <Paper
          key={item.label}
          variant="outlined"
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderRadius: '16px',
            boxShadow: 'none',
          }}
        >
          <Typography sx={{ fontWeight: 750, fontSize: { xs: 23, sm: 28 } }}>
            {item.value}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            {item.label}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}

export function CompetitionEmpty({
  title,
  description,
  action,
  onAction,
  to,
}: {
  title: string;
  description: string;
  action: string;
  onAction?: () => void;
  to?: string;
}) {
  return (
    <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
      <Box
        aria-hidden
        sx={{
          width: 48,
          height: 48,
          borderRadius: '16px',
          bgcolor: '#edf4ff',
          color: 'primary.main',
          display: 'grid',
          placeItems: 'center',
          mx: 'auto',
          mb: 2,
          fontSize: 24,
        }}
      >
        ＋
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 650 }}>
        {title}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ fontSize: 14, maxWidth: 440, mx: 'auto', mt: 1, mb: 2.5 }}
      >
        {description}
      </Typography>
      {to ? (
        <Button component={Link} to={to} variant="outlined">
          {action}
        </Button>
      ) : (
        <Button onClick={onAction} variant="outlined">
          {action}
        </Button>
      )}
    </Box>
  );
}

export function CompetitionFilters({
  children,
  active,
}: {
  children: ReactNode;
  active: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box sx={{ mb: 3 }}>
      <Button
        variant="outlined"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: { xs: 'flex', sm: 'none' },
          mb: expanded ? 2 : 0,
          width: '100%',
        }}
      >
        {expanded
          ? 'Скрыть фильтры'
          : active
            ? 'Изменить фильтры · включены'
            : 'Показать фильтры'}
      </Button>
      <Box
        sx={{
          display: { xs: expanded ? 'block' : 'none', sm: 'block' },
          '& > .MuiPaper-root': {
            mb: 0,
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '16px',
          },
          '& > .MuiPaper-root > .MuiTextField-root': {
            flex: '1 1 180px',
            minWidth: { xs: 0, sm: 150 },
            width: { xs: '100%', sm: 'auto' },
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
