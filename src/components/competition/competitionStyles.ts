/** Shared spacing and responsive surfaces for competition administration. */
export const competitionPageSx = {
  maxWidth: 1440,
  mx: 'auto',
  p: { xs: 2, md: 4 },
  minWidth: 0,
  '& > .MuiPaper-root': {
    boxShadow: 'none',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '16px',
  },
  '& .MuiTableContainer-root': { maxWidth: '100%', overflowX: 'auto' },
  '& .MuiTableHead-root': { bgcolor: '#f7f9fc' },
  '& .MuiTableHead-root .MuiTableCell-root': {
    color: 'text.secondary',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  '& .MuiTableCell-root': { py: 2, borderColor: '#edf0f5' },
  '& .MuiTableRow-hover:hover': { bgcolor: '#f4f8ff' },
  '@media (max-width: 599px)': {
    '& .MuiTable-root, & .MuiTableBody-root': { display: 'block' },
    '& .MuiTableHead-root': { display: 'none' },
    '& .MuiTableBody-root .MuiTableRow-root': {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      p: 1,
      borderBottom: '1px solid #e5eaf2',
    },
    '& .MuiTableBody-root .MuiTableCell-root': {
      display: 'block',
      px: 1,
      py: 1,
      border: 0,
      textAlign: 'left',
      overflowWrap: 'anywhere',
    },
    '& .MuiTableBody-root .MuiTableCell-root:first-of-type, & .MuiTableBody-root .MuiTableCell-root:last-of-type':
      { gridColumn: '1 / -1' },
    '& .MuiTableBody-root .MuiTableCell-root::before': {
      content: 'attr(data-label)',
      display: 'block',
      fontSize: 11,
      color: '#65748b',
      mb: 0.5,
    },
  },
  '& > .MuiPaper-root > .MuiTextField-root': {
    flex: '1 1 180px',
    minWidth: { xs: 0, sm: 150 },
    width: { xs: '100%', sm: 'auto' },
  },
};
