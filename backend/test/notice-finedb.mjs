import assert from 'node:assert/strict';
import { noticesFor, userDeptJobIds } from '../src/source-repository.js';

function createNoticeFixtureDb({ mappingRows, noticeRows, dimUserRows = [] }) {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (sql.includes('FROM dim_bi_user u INNER JOIN dim_dept_mapping m')) {
        const [username, , fineUserIds] = params;
        const userDepts = new Set(
          dimUserRows
            .filter(u => u.username === username && u.enable === 'true' && (!fineUserIds || fineUserIds.includes(u.id)))
            .map(u => u.oa_dept_code.trim()),
        );
        const deptNames = new Set(mappingRows.filter(m => userDepts.has(m.dept_job_id.trim())).map(m => m.dept_name.trim()));
        return {
          rows: noticeRows.filter(n => n.notice_dept_name.split(',').some(d => deptNames.has(d.trim()))),
        };
      }
      if (sql.includes('FROM dim_dept_mapping m') && sql.includes('WHERE trim(m.dept_job_id) = ANY($1::text[])')) {
        const [deptJobIds] = params;
        const idSet = new Set(deptJobIds.map(id => id.trim()));
        const deptNames = new Set(mappingRows.filter(m => idSet.has(m.dept_job_id.trim())).map(m => m.dept_name.trim()));
        return {
          rows: noticeRows.filter(n => n.notice_dept_name.split(',').some(d => deptNames.has(d.trim()))),
        };
      }
      throw new Error(`Unexpected portal DB query: ${sql}`);
    },
  };
}

function createFineDbFixture({ users, userRoles, depRoles, error = null }) {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (error) throw error;
      assert(sql.includes('fine_user_role_middle'), 'expected fine_user_role_middle query');
      assert(sql.includes('fine_dep_role'), 'expected fine_dep_role join');
      assert(sql.includes('urm.roletype = 1'), 'expected roletype = 1 department-post filter');
      const [username, fineUserIds] = params;
      const matchedUserIds = new Set(
        users
          .filter(u => u.username === username && ['true', 't'].includes(String(u.enable)) && (!fineUserIds || fineUserIds.includes(u.id)))
          .map(u => u.id),
      );
      const depRoleMap = new Map(depRoles.map(d => [d.id, d.departmentid]));
      const ids = new Set();
      for (const urm of userRoles) {
        if (!matchedUserIds.has(urm.userid) || urm.roletype !== 1) continue;
        if (urm.roleid && urm.roleid.trim()) ids.add(urm.roleid.trim());
        const deptId = depRoleMap.get(urm.roleid);
        if (deptId && deptId.trim()) ids.add(deptId.trim());
      }
      return { rows: [...ids].map(dep_id => ({ dep_id })) };
    },
  };
}

const mappingRows = [
  { dept_job_id: 'oa-dept-pharma', dept_name: '药品事业群' },
  { dept_job_id: 'dep-role-supply', dept_name: '供应链运营中心' },
  { dept_job_id: 'stale-t1-dept', dept_name: '旧部门' },
];

const noticeRows = [
  { notice_uuid: 'n-pharma', notice_title: '药品公告', notice_dept_name: '药品事业群', notice_is_top: '1', notice_register_day_id: '2026-11-24', notice_content: '内容1' },
  { notice_uuid: 'n-supply', notice_title: '供应链公告', notice_dept_name: '供应链运营中心, 财务部', notice_is_top: '0', notice_register_day_id: '2026-11-23', notice_content: '内容2' },
  { notice_uuid: 'n-stale', notice_title: '旧部门公告', notice_dept_name: '旧部门', notice_is_top: '0', notice_register_day_id: '2026-11-22', notice_content: '旧内容' },
];

const dimUserRows = [
  { id: 'u-1', username: 'alice', enable: 'true', oa_dept_code: 'stale-t1-dept' },
];

// 1. Real-time FineDB department lookup resolves both fine_dep_role.departmentid and fine_user_role_middle.roleid, ignoring roletype=2 and T+1 dim_bi_user.
{
  const portalDb = createNoticeFixtureDb({ mappingRows, noticeRows, dimUserRows });
  const fineDb = createFineDbFixture({
    users: [{ id: 'u-1', username: 'alice', enable: true }],
    userRoles: [
      { userid: 'u-1', roleid: 'dr-1', roletype: 1 },
      { userid: 'u-1', roleid: 'dep-role-supply', roletype: 1 },
      { userid: 'u-1', roleid: 'custom-role-ignored', roletype: 2 },
    ],
    depRoles: [{ id: 'dr-1', departmentid: 'oa-dept-pharma' }],
  });
  const context = { user: { userName: 'alice', fineUserIds: ['u-1'] } };
  const ids = await userDeptJobIds(fineDb, context, { env: { FINEDB_HOST: 'finedb.internal', FINEDB_SCHEMA: 'public' } });
  assert.deepEqual(ids.sort(), ['dep-role-supply', 'dr-1', 'oa-dept-pharma']);
  assert(fineDb.queries[0].sql.includes('FROM public.fine_user_role_middle'));

  const notices = await noticesFor(portalDb, context, { fineDb, env: { FINEDB_HOST: 'finedb.internal', FINEDB_SCHEMA: 'public' } });
  assert.deepEqual(notices.map(n => n.id), ['n-pharma', 'n-supply']);
  assert.equal(portalDb.queries.length, 1);
  assert(!portalDb.queries[0].sql.includes('dim_bi_user'), 'real-time notice lookup must not query T+1 dim_bi_user');
}

// 2. Empty FineDB department result returns [] immediately without falling back to stale dim_bi_user.
{
  const portalDb = createNoticeFixtureDb({ mappingRows, noticeRows, dimUserRows });
  const fineDb = createFineDbFixture({
    users: [{ id: 'u-1', username: 'alice', enable: true }],
    userRoles: [{ userid: 'u-1', roleid: 'custom-role-only', roletype: 2 }],
    depRoles: [],
  });
  const context = { user: { userName: 'alice', fineUserIds: ['u-1'] } };
  const notices = await noticesFor(portalDb, context, { fineDb, env: { FINEDB_SCHEMA: 'finedb' } });
  assert.deepEqual(notices, []);
  assert.equal(portalDb.queries.length, 0);
}

// 3. Missing FineDB table (42P01) logs warning and falls back gracefully to dim_bi_user.
{
  const warnings = [];
  const portalDb = createNoticeFixtureDb({ mappingRows, noticeRows, dimUserRows });
  const missingTableErr = Object.assign(new Error('relation "finedb.fine_dep_role" does not exist'), { code: '42P01' });
  const fineDb = createFineDbFixture({ users: [], userRoles: [], depRoles: [], error: missingTableErr });
  const context = {
    user: { userName: 'alice', fineUserIds: ['u-1'] },
    log: { warn: (meta, msg) => warnings.push({ meta, msg }) },
  };
  const notices = await noticesFor(portalDb, context, { fineDb, env: { FINEDB_SCHEMA: 'finedb' } });
  assert.deepEqual(notices.map(n => n.id), ['n-stale']);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].meta.code, '42P01');
  assert(portalDb.queries[0].sql.includes('dim_bi_user'));
}

// 4. Unexpected FineDB connection errors propagate rather than silently serving stale notices.
{
  const portalDb = createNoticeFixtureDb({ mappingRows, noticeRows, dimUserRows });
  const connErr = Object.assign(new Error('connection lost'), { code: '08006' });
  const fineDb = createFineDbFixture({ users: [], userRoles: [], depRoles: [], error: connErr });
  await assert.rejects(
    () => noticesFor(portalDb, { user: { userName: 'alice', fineUserIds: ['u-1'] } }, { fineDb }),
    err => err.code === '08006',
  );
}

console.log('PASS: real-time FineDB notice department lookup, empty-set handling, and graceful fallback verified.');
