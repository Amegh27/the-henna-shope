export function notFound(req, res) {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  console.error('========== BACKEND ERROR ==========');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('===================================');

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      message: 'A record with that value already exists.',
    });
  }

  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Internal server error.',
  });
}