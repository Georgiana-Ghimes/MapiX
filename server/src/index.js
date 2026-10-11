import app from './app.js';

const port = Number(process.env.PORT) || 3002;

app.listen(port, () => {
  console.log(`MapiX API listening on http://127.0.0.1:${port}`);
});
