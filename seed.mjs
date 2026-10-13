// Demo data seeder (T-21). Uses the API only, never SQL (data-model.md section 9).
// Usage: ADMIN_USERNAME=... ADMIN_PASSWORD=... node seed.mjs http://localhost:8000/api/v1
// Run it once, on an empty database.

const api = process.argv[2];
const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
if (!api || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('Uso: ADMIN_USERNAME=... ADMIN_PASSWORD=... node seed.mjs <url de la API>');
  process.exit(1);
}

let token = null;
async function call(method, path, body) {
  const res = await fetch(api + path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

token = (await call('POST', '/auth/login', { username: ADMIN_USERNAME, password: ADMIN_PASSWORD })).access_token;
const categories = await call('GET', '/categories');

// 40 books, 8 per category.
const books = [];
for (let i = 1; i <= 40; i++) {
  const category = categories[(i - 1) % categories.length];
  const book = await call('POST', '/books', {
    title: `${category.name}: libro ${String(i).padStart(2, '0')}`,
    author: `Autor ${((i - 1) % 12) + 1}`,
    isbn: `978000000${String(i).padStart(4, '0')}`,
    category_id: category.id,
    total_copies: (i % 4) + 1,
  });
  books.push(book);
}

// 10 members.
const members = [];
for (let i = 1; i <= 10; i++) {
  members.push(await call('POST', '/members', { full_name: `Socio de demostración ${i}`, document_number: `DEMO-${1000 + i}` }));
}

// 15 loans: one per member plus five more for the first members (never above 3 unreturned books).
const loans = [];
for (let i = 0; i < 15; i++) {
  const member = members[i % members.length];
  const book = books[(i * 3) % books.length];
  loans.push(await call('POST', '/loans', { member_id: member.id, items: [{ book_id: book.id }] }));
}

// Return a few lines so the loans show both open and closed states.
for (const loan of loans.slice(0, 4)) {
  await call('POST', `/loans/${loan.id}/items/${loan.items[0].id}/return`);
}

console.log(`Libros: ${books.length} · Socios: ${members.length} · Préstamos: ${loans.length} (4 devueltos)`);
// T-21 also asks for 3 overdue lines. The API always lends at the current instant with a 14-day term,
// so an overdue loan cannot be created through the API (docs ADR-005, INC-06).
console.log('Vencidos: 0. No se pueden crear por la API (ver ADR-005, INC-06).');
