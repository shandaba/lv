(() => {
  if (document.getElementById('xlxTaskModal')) return;

  const style = document.createElement('style');
  style.textContent = [
    '.xlx-modal-mask{position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.72);backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;padding:28px}',
    '.xlx-modal-mask.show{display:flex}',
    '.xlx-modal{width:min(760px,calc(100vw - 40px));max-height:calc(100vh - 56px);overflow:auto;background:linear-gradient(180deg,#121b2d,#0e1626);border:1px solid #32415f;border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.42);padding:26px}',
    '.xlx-modal-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:22px}',
    '.xlx-modal-title{font-size:25px;font-weight:780;line-height:1.25}',
    '.xlx-modal-sub{font-size:14px;color:#9aa8bf;margin-top:6px}',
    '.xlx-modal-close{width:38px;height:38px;border-radius:10px;border:1px solid #2a3955;background:#162033;color:#d8dfeb;cursor:pointer;font-size:22px;line-height:1}',
    '.xlx-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}',
    '.xlx-form-grid .full{grid-column:1/-1}',
    '.xlx-modal label{display:block;font-size:14px;color:#aeb9ca;margin-bottom:7px}',
    '.xlx-modal input,.xlx-modal textarea,.xlx-modal select{width:100%;background:#0b1322;color:#fff;border:1px solid #2d3d5a;border-radius:12px;padding:12px 13px;outline:none;font-size:16px}',
    '.xlx-modal textarea{min-height:92px;resize:vertical}',
    '.xlx-modal input:focus,.xlx-modal textarea:focus,.xlx-modal select:focus{border-color:#6e8cff;box-shadow:0 0 0 3px rgba(110,140,255,.12)}',
    '.xlx-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}',
    '.xlx-modal-actions button{min-width:92px}',
    '@media(max-width:760px){.xlx-form-grid{grid-template-columns:1fr}.xlx-form-grid .full{grid-column:auto}}'
  ].join('\n');
  document.head.appendChild(style);

  const mask = document.createElement('div');
  mask.id = 'xlxTaskModal';
  mask.className = 'xlx-modal-mask';
  mask.innerHTML = '<div class="xlx-modal" role="dialog" aria-modal="true" aria-labelledby="xlxTaskTitle">' +
    '<div class="xlx-modal-head"><div><div class="xlx-modal-title" id="xlxTaskTitle">新增任务</div><div class="xlx-modal-sub">按结果创建任务，而不是只记一个待办标题</div></div><button class="xlx-modal-close" type="button" data-close>×</button></div>' +
    '<form id="xlxTaskForm"><div class="xlx-form-grid">' +
    '<div class="full"><label>任务名称 *</label><input id="xlxTitle" required maxlength="120" placeholder="例如：完成9月朋友圈投流首轮素材测试"></div>' +
    '<div><label>负责人</label><select id="xlxOwner"><option>我</option><option>兼职编辑</option><option>兼职品宣</option><option>兼职投流</option><option>AI</option></select></div>' +
    '<div><label>优先级</label><select id="xlxPriority"><option>S</option><option selected>A</option><option>B</option></select></div>' +
    '<div><label>增长主线</label><select id="xlxTrack"><option>有效线索</option><option>业务机会</option><option>声量</option><option selected>协同</option></select></div>' +
    '<div><label>截止时间</label><input id="xlxDue" placeholder="今天 / 明天 / 本周 / 具体日期" value="今天"></div>' +
    '<div><label>预计用时（分钟）</label><input id="xlxEstimate" type="number" min="5" step="5" value="60"></div>' +
    '<div class="full"><label>可验证结果</label><textarea id="xlxResult" placeholder="完成后必须得到什么结果"></textarea></div>' +
    '<div class="full"><label>执行动作</label><textarea id="xlxAction" placeholder="关键动作、步骤或协同事项"></textarea></div>' +
    '<div class="full"><label>验收标准</label><textarea id="xlxMetric" placeholder="例如：至少产出3版素材，完成500元测试投放，形成CTR/CPL对比"></textarea></div>' +
    '</div><div class="xlx-modal-actions"><button class="btn" type="button" data-close>取消</button><button class="btn primary" type="submit">保存任务</button></div></form></div>';
  document.body.appendChild(mask);

  const close = () => mask.classList.remove('show');
  const open = () => {
    document.getElementById('xlxTaskForm').reset();
    document.getElementById('xlxOwner').value = '我';
    document.getElementById('xlxPriority').value = 'A';
    document.getElementById('xlxTrack').value = '协同';
    document.getElementById('xlxDue').value = '今天';
    document.getElementById('xlxEstimate').value = '60';
    mask.classList.add('show');
    setTimeout(() => document.getElementById('xlxTitle').focus(), 20);
  };

  mask.addEventListener('click', e => {
    if (e.target === mask || e.target.matches('[data-close]')) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });

  quickTask = async function () { open(); };

  document.getElementById('xlxTaskForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('xlxTitle').value.trim();
    if (!title) return;

    state.tasks = state.tasks || [];
    state.tasks.push({
      id: crypto.randomUUID(),
      title,
      result: document.getElementById('xlxResult').value.trim(),
      owner: document.getElementById('xlxOwner').value,
      priority: document.getElementById('xlxPriority').value,
      track: document.getElementById('xlxTrack').value,
      due: document.getElementById('xlxDue').value.trim() || '今天',
      estimate: Number(document.getElementById('xlxEstimate').value || 60),
      action: document.getElementById('xlxAction').value.trim(),
      metric: document.getElementById('xlxMetric').value.trim() || '完成并形成可验证结果',
      status: 'todo',
      createdAt: new Date().toISOString()
    });

    await persist();
    renderAll();
    close();
    showPage('tasks');
  });
})();
