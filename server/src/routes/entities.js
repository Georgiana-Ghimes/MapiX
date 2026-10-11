import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import {
  ENTITY_MAP,
  buildFilterClauses,
  decodeCursor,
  encodeCursor,
  parseOrder,
  pickWritable,
  projectFields,
  serializeRow,
} from '../entities.js';

const router = Router();
router.use(authRequired);

function getCfg(name) {
  return ENTITY_MAP[name] || null;
}

function allowedFilterKeys(cfg) {
  return new Set(['id', 'created_by_id', ...cfg.writable]);
}

function ownerClause(cfg, user, startIndex) {
  if (!cfg.ownerScoped || user.role === 'admin') {
    return { sql: null, params: [], nextIndex: startIndex };
  }
  return {
    sql: `created_by_id = $${startIndex}`,
    params: [user.id],
    nextIndex: startIndex + 1,
  };
}

function adminWriteGuard(entity, user, res) {
  const publicWritable = new Set(['Alerta', 'Vehicul', 'Cursa', 'CursaTaxa']);
  if (user.role === 'admin' || publicWritable.has(entity)) return true;
  res.status(403).json({ message: 'Doar administratorii pot modifica aceste date.' });
  return false;
}

async function selectPage(entity, user, filters, { sort, limit, cursor, fields }) {
  const cfg = getCfg(entity);
  const order = parseOrder(sort);
  const pageLimit = Math.min(Number(limit) || 200, 1000);
  const offset = decodeCursor(cursor);

  let idx = 1;
  const where = [];
  const params = [];

  const owner = ownerClause(cfg, user, idx);
  if (owner.sql) {
    where.push(owner.sql);
    params.push(...owner.params);
    idx = owner.nextIndex;
  }

  const built = buildFilterClauses(filters, {
    allowedKeys: allowedFilterKeys(cfg),
    startIndex: idx,
  });
  where.push(...built.clauses);
  params.push(...built.params);
  idx = built.nextIndex;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(pageLimit + 1, offset);
  const result = await query(
    `SELECT * FROM ${cfg.table}
     ${whereSql}
     ORDER BY ${order}
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  const hasMore = result.rows.length > pageLimit;
  const slice = hasMore ? result.rows.slice(0, pageLimit) : result.rows;
  let items = slice.map((row) => serializeRow(row, entity));
  items = projectFields(items, fields);
  return {
    items,
    has_more: hasMore,
    next_cursor: hasMore ? encodeCursor(offset + pageLimit) : null,
  };
}

router.get('/:entity', async (req, res) => {
  try {
    const cfg = getCfg(req.params.entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });
    if (cfg.adminListOnly && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acces interzis.' });
    }
    const page = await selectPage(req.params.entity, req.user, {}, {
      sort: req.query.sort || req.query.order,
      limit: req.query.limit,
      cursor: req.query.cursor,
      fields: req.query.fields ? String(req.query.fields).split(',') : null,
    });
    // list() returns a bare array in the old SDK
    res.json(page.items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'List failed' });
  }
});

router.post('/:entity/filter', async (req, res) => {
  try {
    const cfg = getCfg(req.params.entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });
    if (cfg.adminListOnly && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acces interzis.' });
    }
    const body = req.body || {};
    const filters = body.query || body.filters || body;
    const options = body.options || body;
    const page = await selectPage(req.params.entity, req.user, filters, {
      sort: options.sort || options.order || body.sort,
      limit: options.limit || body.limit,
      cursor: options.cursor || body.cursor,
      fields: options.fields || body.fields,
    });
    res.json(page);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Filter failed' });
  }
});

router.post('/:entity/count', async (req, res) => {
  try {
    const cfg = getCfg(req.params.entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });

    let idx = 1;
    const where = [];
    const params = [];
    const owner = ownerClause(cfg, req.user, idx);
    if (owner.sql) {
      where.push(owner.sql);
      params.push(...owner.params);
      idx = owner.nextIndex;
    }
    const filters = req.body?.query || req.body?.filters || req.body || {};
    const built = buildFilterClauses(filters, {
      allowedKeys: allowedFilterKeys(cfg),
      startIndex: idx,
    });
    where.push(...built.clauses);
    params.push(...built.params);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(`SELECT COUNT(*)::int AS c FROM ${cfg.table} ${whereSql}`, params);
    res.json({ count: result.rows[0].c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Count failed' });
  }
});

router.post('/:entity/aggregate', async (req, res) => {
  try {
    const cfg = getCfg(req.params.entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });
    const groupBy = String(req.body?.groupBy || '');
    if (!/^[a-z0-9_]+$/i.test(groupBy) || !allowedFilterKeys(cfg).has(groupBy)) {
      return res.status(400).json({ message: 'groupBy invalid.' });
    }
    const limit = Math.min(Number(req.body?.limit) || 1000, 5000);
    let idx = 1;
    const where = [];
    const params = [];
    const owner = ownerClause(cfg, req.user, idx);
    if (owner.sql) {
      where.push(owner.sql);
      params.push(...owner.params);
      idx = owner.nextIndex;
    }
    const built = buildFilterClauses(req.body?.query || {}, {
      allowedKeys: allowedFilterKeys(cfg),
      startIndex: idx,
    });
    where.push(...built.clauses);
    params.push(...built.params);
    idx = built.nextIndex;
    params.push(limit);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(
      `SELECT ${groupBy} AS ${groupBy}, COUNT(*)::int AS count
       FROM ${cfg.table}
       ${whereSql}
       GROUP BY ${groupBy}
       ORDER BY count DESC
       LIMIT $${idx}`,
      params
    );
    res.json({ rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Aggregate failed' });
  }
});

router.get('/:entity/:id', async (req, res) => {
  try {
    const cfg = getCfg(req.params.entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });
    const result = await query(`SELECT * FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: 'Negăsit.' });
    if (cfg.ownerScoped && req.user.role !== 'admin' && row.created_by_id !== req.user.id) {
      return res.status(404).json({ message: 'Negăsit.' });
    }
    res.json(serializeRow(row, req.params.entity));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Get failed' });
  }
});

router.post('/:entity', async (req, res) => {
  try {
    const entity = req.params.entity;
    const cfg = getCfg(entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });
    if (entity === 'User') return res.status(405).json({ message: 'Creează utilizatori prin invitație.' });
    if (!adminWriteGuard(entity, req.user, res)) return;

    const data = pickWritable(cfg, req.body);
    data.created_by_id = req.user.id;
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, idx) => `$${idx + 1}`);
    const result = await query(
      `INSERT INTO ${cfg.table} (${keys.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );
    res.status(201).json(serializeRow(result.rows[0], entity));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Create failed' });
  }
});

router.post('/:entity/bulk', async (req, res) => {
  try {
    const entity = req.params.entity;
    const cfg = getCfg(entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });
    if (entity === 'User') return res.status(405).json({ message: 'Bulk user create disabled.' });
    if (!adminWriteGuard(entity, req.user, res)) return;

    const items = Array.isArray(req.body) ? req.body : req.body?.items || [];
    const created = await withTransaction(async (client) => {
      const rows = [];
      for (const item of items) {
        const data = pickWritable(cfg, item);
        data.created_by_id = req.user.id;
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, idx) => `$${idx + 1}`);
        const result = await client.query(
          `INSERT INTO ${cfg.table} (${keys.join(', ')})
           VALUES (${placeholders.join(', ')})
           RETURNING *`,
          values
        );
        rows.push(serializeRow(result.rows[0], entity));
      }
      return rows;
    });
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Bulk create failed' });
  }
});

router.patch('/:entity/:id', async (req, res) => {
  try {
    const entity = req.params.entity;
    const cfg = getCfg(entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });
    if (!adminWriteGuard(entity, req.user, res)) return;

    const existing = await query(`SELECT * FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
    const row = existing.rows[0];
    if (!row) return res.status(404).json({ message: 'Negăsit.' });
    if (cfg.ownerScoped && req.user.role !== 'admin' && row.created_by_id !== req.user.id) {
      return res.status(404).json({ message: 'Negăsit.' });
    }

    const data = pickWritable(cfg, req.body);
    data.updated_at = new Date().toISOString();
    const keys = Object.keys(data);
    if (keys.length === 0) return res.json(serializeRow(row, entity));
    const sets = keys.map((k, idx) => `${k} = $${idx + 1}`);
    const values = [...Object.values(data), req.params.id];
    const result = await query(
      `UPDATE ${cfg.table}
       SET ${sets.join(', ')}
       WHERE id = $${keys.length + 1}
       RETURNING *`,
      values
    );
    res.json(serializeRow(result.rows[0], entity));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Update failed' });
  }
});

router.delete('/:entity/:id', async (req, res) => {
  try {
    const entity = req.params.entity;
    const cfg = getCfg(entity);
    if (!cfg) return res.status(404).json({ message: 'Entitate necunoscută.' });
    if (req.user.role !== 'admin' && !cfg.ownerScoped) {
      return res.status(403).json({ message: 'Ștergere interzisă.' });
    }
    const existing = await query(`SELECT * FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
    const row = existing.rows[0];
    if (!row) return res.status(404).json({ message: 'Negăsit.' });
    if (cfg.ownerScoped && req.user.role !== 'admin' && row.created_by_id !== req.user.id) {
      return res.status(404).json({ message: 'Negăsit.' });
    }
    await query(`DELETE FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Delete failed' });
  }
});

export default router;
