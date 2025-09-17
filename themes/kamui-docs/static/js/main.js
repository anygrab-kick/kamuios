// テーマ（黒/白）切替
const themeDarkBtn = document.getElementById('themeDark');
const themeLightBtn = document.getElementById('themeLight');
function applyTheme(theme) {
  const mode = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  themeDarkBtn.classList.toggle('active', mode === 'dark');
  themeLightBtn.classList.toggle('active', mode === 'light');
}
const savedTheme = localStorage.getItem('theme');
const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
applyTheme(savedTheme || (prefersLight ? 'light' : 'dark'));
themeDarkBtn.addEventListener('click', () => applyTheme('dark'));
themeLightBtn.addEventListener('click', () => applyTheme('light'));

// 目次（TOC）動的生成 + スクロール
function buildToc(){
  const tocList = document.getElementById('tocList');
  if (!tocList) return [];
  tocList.innerHTML = '';
  const sections = Array.from(document.querySelectorAll('.doc-section'))
    // ダッシュボードの配下セクションはTOCから除外（重複回避）
    .filter(sec => sec.id !== 'saas-applications-overview')
    // 特定の要件定義書は 2-1 の配下にサブ項目として表示するため、トップレベルからは除外
    .filter(sec => !['requirements-kamui-os','requirements-kamui-os-npm','requirements-sns-marketing','requirements-neko-cafe'].includes(sec.id));
  const groups = new Map(); // catValue -> { name, items: [{id,title}] }
  // ダッシュボードカテゴリを追加
  groups.set(1, { name: 'ダッシュボード', items: [] });
  sections.forEach(sec => {
    const catVal = Number(sec.dataset.cat || '0');
    const catName = sec.dataset.catName || 'その他';
    const id = sec.id ? `#${sec.id}` : '';
    const h2 = sec.querySelector('h2');
    const isPrivate = sec.dataset.isPrivate === 'true';
    let title = h2 ? (h2.innerText || h2.textContent || id) : id;
    title = title.replace(/^\s*\d+[.\-]\s*/, '');
    // private_ファイルの場合は鍵アイコンを追加（既にHTMLで追加されている場合は重複を避ける）
    if (isPrivate && !title.includes('🔒')) {
      title = `🔒 ${title}`;
    }
    // ダッシュボード項目は除外
    if (id === '#saas-applications-overview') return;
    // 章1（ダッシュボード）配下の項目もTOCに含める
    // if (catVal === 1) return;
    if (!groups.has(catVal)) groups.set(catVal, { name: catName, items: [] });
    // 重複IDを除外
    const grp = groups.get(catVal);
    if (!grp.items.some(it => it.id === id)) {
      grp.items.push({ id, title });
    }
  });
  // 章1に「メインダッシュボード」を先頭として明示追加
  if (groups.has(1)) {
    const g1 = groups.get(1);
    if (!g1.items.some(it => it.id === '#saas-applications-overview')) {
      g1.items.unshift({ id: '#saas-applications-overview', title: 'メインダッシュボード' });
    }
  }
  const sortedCats = Array.from(groups.keys()).sort((a,b)=>a-b);
  sortedCats.forEach((catValue, catIdx) => {
    const cat = groups.get(catValue);
    // 章名の補正: 1は常に「ダッシュボード」にする
    const catNo = catIdx + 1;
    const catItem = document.createElement('div');
    catItem.className = 'tree-item';
    const catLabel = document.createElement('div');
    catLabel.className = 'tree-label category';
    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    toggle.textContent = '▶';
    const name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = `${catNo}. ${cat.name}`;
    catLabel.appendChild(toggle);
    catLabel.appendChild(name);
    const children = document.createElement('div');
    children.className = 'tree-children';
    cat.items.forEach((it, i) => {
      const item = document.createElement('div');
      item.className = 'tree-item';
      const label = document.createElement('div');
      label.className = 'tree-label';
      label.setAttribute('data-target', it.id);
      const nm = document.createElement('span');
      nm.className = 'tree-name';
      nm.textContent = `${catNo}-${i+1}. ${it.title}`;
      label.appendChild(nm);
      item.appendChild(label);
      children.appendChild(item);

      // 特別: 2-1 要件定義書の配下にサブ項目（KAMUI CODE/KAMUI OS）を追加
      if (it.id === '#requirements-document') {
        const sub = document.createElement('div');
        sub.className = 'tree-children';
        const subItems = [
          { id: '#requirements-document',        title: 'KAMUI CODE 要件定義書',            openBody: true },
          { id: '#requirements-kamui-os',       title: 'KAMUI OS 要件定義書',              openBody: true },
          { id: '#requirements-kamui-os-npm',   title: 'KAMUI OS NPM 要件定義書',          openBody: true },
          { id: '#requirements-sns-marketing',  title: 'SNSマーケティング ダッシュボード要件', openBody: true },
          { id: '#requirements-neko-cafe',      title: 'ネコカフェ 要件定義書',              openBody: true }
        ];
        // 折りたたみトグル（2-1 の子を開閉）
        const subToggle = document.createElement('span');
        subToggle.className = 'tree-toggle';
        subToggle.textContent = '▶';
        // ラベル先頭にトグルを差し込む
        label.insertBefore(subToggle, label.firstChild);
        subToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          sub.classList.toggle('expanded');
          subToggle.classList.toggle('expanded');
          subToggle.textContent = sub.classList.contains('expanded') ? '▼' : '▶';
        });
        subItems.forEach((sit, si) => {
          const sItem = document.createElement('div');
          sItem.className = 'tree-item';
          const sLabel = document.createElement('div');
          sLabel.className = 'tree-label';
          sLabel.setAttribute('data-target', sit.id);
          sLabel.setAttribute('data-open-body', sit.openBody ? 'true' : 'false');
          const sName = document.createElement('span');
          sName.className = 'tree-name';
          sName.textContent = `${catNo}-${i+1}-${si+1}. ${sit.title}`;
          sLabel.appendChild(sName);
          sItem.appendChild(sLabel);
          sub.appendChild(sItem);
        });
        item.appendChild(sub);
      }
    });
    // カテゴリラベルのトグル処理はビルド後に一括で付与（重複防止）
    catItem.appendChild(catLabel);
    catItem.appendChild(children);
    tocList.appendChild(catItem);
  });
  // ダッシュボードカテゴリにも子要素を表示する
  // const firstCat = tocList.querySelector('.tree-label.category');
  // if (firstCat && firstCat.nextElementSibling) {
  //   firstCat.nextElementSibling.innerHTML = '';
  // }
  return Array.from(tocList.querySelectorAll('.tree-label[data-target]'));
}

// 本文を目次の順番に並べ替え、見出しを X-Y に採番
function reorderBodySectionsToMatchToc(){
  const container = document.getElementById('docContainer');
  if (!container) return [];
  const secNodes = new Map();
  document.querySelectorAll('.doc-section').forEach(sec => {
    if (sec.id) secNodes.set(`#${sec.id}`, sec);
  });
  const orderedIds = [];
  const seen = new Set();
  document.querySelectorAll('#tocList .tree-label[data-target]').forEach(l => {
    const id = l.getAttribute('data-target');
    if (id && !seen.has(id)) { seen.add(id); orderedIds.push(id); }
  });
  const frag = document.createDocumentFragment();
  // 先頭にダッシュボードを固定配置
  const dash = secNodes.get('#saas-applications-overview');
  if (dash) frag.appendChild(dash);
  orderedIds.forEach(id => {
    const node = secNodes.get(id);
    if (node) frag.appendChild(node);
  });
  container.appendChild(frag);
  return orderedIds;
}

function renumberBodyHeadingsByOrder(orderedIds){
  const secById = new Map();
  document.querySelectorAll('.doc-section').forEach(sec => {
    if (sec.id) secById.set(`#${sec.id}`, sec);
  });
  const catOrder = new Map();
  const catCounters = new Map();
  let catNoSeq = 0;
  orderedIds.forEach(id => {
    const sec = secById.get(id);
    if (!sec) return;
    const catVal = String(sec.dataset.cat || '0');
    if (!catOrder.has(catVal)) {
      catOrder.set(catVal, ++catNoSeq);
      catCounters.set(catVal, 0);
    }
    const h2 = sec.querySelector('h2');
    if (!h2) return;
    const raw = h2.innerText || h2.textContent || '';
    const base = raw.replace(/^\s*\d+[.\-]\s*/, '');
    const x = catOrder.get(catVal);
    const y = (catCounters.get(catVal) || 0) + 1;
    catCounters.set(catVal, y);
    h2.textContent = `${x}-${y}. ${base}`;
  });
}

const tocRoot = document.getElementById('folderTree');
// TOCを構築 → 本文をTOC順に並べ替え → 見出し採番
let itemLabels = buildToc();
const orderedIds = reorderBodySectionsToMatchToc();
renumberBodyHeadingsByOrder(orderedIds);
const sectionCount = document.getElementById('sectionCount');
sectionCount.textContent = itemLabels.length;

// クリックで本文へスクロール（項目のみ）
itemLabels.forEach(l => {
  l.addEventListener('click', (e) => {
    e.stopPropagation();
    const target = l.getAttribute('data-target');
    const openBody = l.getAttribute('data-open-body') === 'true';
    if (target) {
      // 擬似遷移: すべて非表示にして対象のみ表示 + URLハッシュ更新
      if (target.startsWith('#saas-')) {
        const appId = target.replace('#saas-', '');
        if (window.showSaasApp) {
          window.showSaasApp(appId);
        }
        return;
      } else if (target.startsWith('#requirements-')) {
        // 要件定義書の場合も特別処理
        const docId = target.replace('#requirements-', '');
        if (window.showRequirements) {
          window.showRequirements(docId);
          if (openBody) {
            setTimeout(() => {
              const secId = 'requirements-' + docId; // 'document' or 'kamui-os'
              const card = document.getElementById('requirementsDocCard-' + secId);
              const body = document.getElementById('requirementsDocBody-' + secId);
              if (card && body) { card.style.display = 'none'; body.style.display = 'block'; window.scrollTo(0, 0); }
            }, 0);
          }
        }
        return;
      } else if (target === '#biz-strategy' || target === '#biz-finance' || target === '#prompts-repo') {
        if (window.showSectionById) {
          window.showSectionById(target.substring(1));
          return;
        }
      } else if (target === '#ui-views') {
        // UIビュー一覧の場合も特別処理
        if (window.showRequirements) {
          window.showRequirements('views');
        }
        return;
      } else if (target === '#slide-generator') {
        // スライドエディタの場合も特別処理
        if (window.showBusinessTool) {
          window.showBusinessTool('slide-generator');
        }
        return;
      } else {
        // 通常のセクションへのスクロール
        const node = document.querySelector(target);
        if (node) {
          document.querySelectorAll('.doc-section').forEach(section => { section.style.display = 'none'; });
          node.style.display = 'block';
          window.history.pushState({ direct: target.substring(1) }, '', target);
          window.scrollTo(0, 0);
        }
      }
      // モバイル時はサイドバーを閉じる
      if (window.matchMedia('(max-width: 768px)').matches) {
        const sb = document.getElementById('sidebar');
        const bd = document.getElementById('sidebarBackdrop');
        sb?.classList.remove('open');
        bd?.classList.remove('show');
      }
    }
  });
});

// 大分類の展開/折りたたみ
tocRoot.querySelectorAll('.tree-label.category').forEach(cat => {
  const toggle = cat.querySelector('.tree-toggle');
  const children = cat.nextElementSibling;
  cat.addEventListener('click', (e) => {
    e.stopPropagation();
    if (children) children.classList.toggle('expanded');
    if (toggle) {
      toggle.classList.toggle('expanded');
      toggle.textContent = children && children.classList.contains('expanded') ? '▼' : '▶';
    }
    cat.classList.toggle('selected');
  });
});

// ルートの折りたたみ
const root = document.querySelector('[data-toggle="root"]');
const rootChildren = document.querySelector('.tree-children');
const rootToggle = root.querySelector('.tree-toggle');
root.addEventListener('click', () => {
  rootChildren.classList.toggle('expanded');
  rootToggle.classList.toggle('expanded');
  rootToggle.textContent = rootChildren.classList.contains('expanded') ? '▼' : '▶';
  root.classList.toggle('selected');
});

// クイックリンク
document.querySelectorAll('.tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const sel = tag.getAttribute('data-jump');
    if (!sel) return;
    
    // SaaSアプリケーションの場合は特別処理
    if (sel.startsWith('#saas-')) {
      const appId = sel.replace('#saas-', '');
      if (window.showSaasApp) {
        window.showSaasApp(appId);
      }
      return;
    } else if (sel.startsWith('#requirements-')) {
      // 要件定義書の場合も特別処理
      const docId = sel.replace('#requirements-', '');
      if (window.showRequirements) {
        window.showRequirements(docId);
      }
      return;
    } else if (sel === '#biz-strategy' || sel === '#biz-finance' || sel === '#prompts-repo') {
      if (window.showSectionById) { window.showSectionById(sel.substring(1)); }
      return;
    } else if (sel === '#ui-views') {
      // UIビュー一覧の場合も特別処理
      if (window.showRequirements) {
        window.showRequirements('views');
      }
      return;
    } else if (sel === '#slide-generator') {
      // スライドエディタの場合も特別処理
      if (window.showBusinessTool) {
        window.showBusinessTool('slide-generator');
      }
      return;
    } else {
      // 通常セクションの擬似遷移
      const node = document.querySelector(sel);
      if (node) {
        document.querySelectorAll('.doc-section').forEach(section => { section.style.display = 'none'; });
        node.style.display = 'block';
        window.history.pushState({ direct: sel.substring(1) }, '', sel);
        window.scrollTo(0, 0);
      }
    }
    
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');
  });
});

// サイドバー開閉（モバイル + デスクトップ）
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebarBackdrop');
const toggleBtn = document.getElementById('toggleSidebar');
function closeSidebar(){ sidebar?.classList.remove('open'); backdrop?.classList.remove('show'); }
function openSidebar(){ sidebar?.classList.add('open'); backdrop?.classList.add('show'); }
toggleBtn?.addEventListener('click', () => {
  if (!sidebar) return;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) {
    // 従来どおりオーバーレイ付きのスライド開閉
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  } else {
    // デスクトップではサイドバー自体を折りたたみ（非表示）
    const collapsed = sidebar.classList.toggle('collapsed');
    if (collapsed) {
      // 念のためモバイル用の状態も解除
      closeSidebar();
    }
  }
});
backdrop?.addEventListener('click', closeSidebar);

// ユーティリティ関数
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
function escapeAttr(s){ return String(s||'').replace(/["<>\n\r]/g,''); }

// 検索（タイトルと本文中テキストを対象）
const searchInput = document.getElementById('searchInput');
// 単純な部分一致での強調（正規表現は使わず安全に）
function highlightTextNode(node, q){
  const text = node.nodeValue || '';
  const query = q.toLowerCase();
  const lower = text.toLowerCase();
  let pos = 0;
  let idx = lower.indexOf(query, pos);
  if (idx === -1) return;
  const frag = document.createDocumentFragment();
  while (idx !== -1){
    const before = text.slice(pos, idx);
    if (before) frag.appendChild(document.createTextNode(before));
    const mark = document.createElement('mark');
    mark.className = 'hl';
    mark.textContent = text.slice(idx, idx + q.length);
    frag.appendChild(mark);
    pos = idx + q.length;
    idx = lower.indexOf(query, pos);
  }
  const after = text.slice(pos);
  if (after) frag.appendChild(document.createTextNode(after));
  node.parentNode && node.parentNode.replaceChild(frag, node);
}
function clearHighlights(root){
  root.querySelectorAll('mark.hl').forEach(m => {
    const text = document.createTextNode(m.textContent || '');
    m.parentNode && m.parentNode.replaceChild(text, m);
  });
}
function highlightInElements(elements, q){
  if (!q) return;
  elements.forEach(el => {
    clearHighlights(el);
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue){
        highlightTextNode(node, q);
      }
    });
  });
}

// モーダル関数
function openJsonModal(content, title){
  const modal = document.getElementById('jsonModal');
  const pre = document.getElementById('jsonContent');
  const ttl = document.getElementById('jsonModalTitle');
  const closeBtn = document.getElementById('jsonCloseBtn');
  const copyBtn = document.getElementById('jsonCopyBtn');
  if (!modal || !pre || !ttl) return;
  pre.textContent = content;
  ttl.textContent = title || 'JSONプレビュー';
  modal.classList.add('active');
  closeBtn?.addEventListener('click', () => modal.classList.remove('active'), { once: true });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); }, { once: true });
  copyBtn?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(content); alert('クリップボードにコピーしました。'); } catch(e) { alert('コピーできませんでした。'); }
  }, { once: true });
}

function openImgModal(src, title){
  const modal = document.getElementById('imgModal');
  const img = document.getElementById('imgModalImage');
  const ttl = document.getElementById('imgModalTitle');
  const closeBtn = document.getElementById('imgCloseBtn');
  if (!modal || !img || !ttl) return;
  img.setAttribute('src', src);
  ttl.textContent = title || '画像プレビュー';
  modal.classList.add('active');
  closeBtn?.addEventListener('click', () => modal.classList.remove('active'), { once: true });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); }, { once: true });
}

// グローバルに公開
window.openJsonModal = openJsonModal;
window.openImgModal = openImgModal;

// 要素情報の収集（簡易 Inspector）
function cssPath(el){
  if (!el || el.nodeType !== 1) return '';
  if (el.id) return `#${el.id}`;
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== document.body){
    let sel = node.nodeName.toLowerCase();
    if (node.classList && node.classList.length){
      const c = Array.from(node.classList).slice(0,3).join('.');
      if (c) sel += `.${c}`;
    }
    const parent = node.parentElement;
    if (parent){
      const siblings = Array.from(parent.children).filter(n => n.nodeName === node.nodeName);
      if (siblings.length > 1){
        const idx = siblings.indexOf(node) + 1;
        sel += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(sel);
    node = node.parentElement;
  }
  return parts.join(' > ');
}

function pickAttrs(el){
  const obj = {};
  if (!el || !el.attributes) return obj;
  Array.from(el.attributes).forEach(a => { obj[a.name] = a.value; });
  return obj;
}

function nearestSection(el){
  const sec = el.closest('.doc-section');
  if (!sec) return null;
  const h2 = sec.querySelector('h2');
  return { id: sec.id || '', category: sec.dataset.cat || '', category_name: sec.dataset.catName || '', title: h2 ? (h2.innerText||'').trim() : '' };
}

function collectElementInfo(el){
  const rect = el.getBoundingClientRect();
  const styles = window.getComputedStyle(el);
  const styleKeys = ['display','position','zIndex','color','backgroundColor','fontSize','fontWeight','margin','padding','border','borderRadius'];
  const styleObj = {};
  styleKeys.forEach(k => { styleObj[k] = styles[k]; });
  const info = {
    page: { url: location.href, title: document.title, hash: location.hash },
    section: nearestSection(el),
    selector: cssPath(el),
    element: {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: Array.from(el.classList||[]),
      attributes: pickAttrs(el),
      dataset: { ...el.dataset },
      text: (el.textContent||'').trim().slice(0, 240)
    },
    box: {
      width: Math.round(rect.width), height: Math.round(rect.height),
      top: Math.round(rect.top + window.scrollY), left: Math.round(rect.left + window.scrollX)
    },
    computed: styleObj,
    time: new Date().toISOString()
  };
  return info;
}

// Alt(Option) + 右クリックで要素情報を取得
document.addEventListener('contextmenu', (e) => {
  try {
    // DevTools ON のときだけ発火
    if (!window.__devToolsActive) return; // 通常のコンテキストメニューを維持
    // 右クリックで発火（特定ターゲットのみ）
    const target = e.target.closest('.saas-app-card, .card, .tree-label, .req-section, .doc-section, [data-path], [class]');
    if (!target) return; // 対象外は通常のコンテキストメニュー
    e.preventDefault();
    // 一時ハイライト
    const prevOutline = target.style.outline;
    const prevOffset = target.style.outlineOffset;
    target.style.outline = '2px solid #4a9eff';
    target.style.outlineOffset = '2px';
    setTimeout(() => { target.style.outline = prevOutline; target.style.outlineOffset = prevOffset; }, 1200);
    const json = JSON.stringify(collectElementInfo(target), null, 2);
    openJsonModal(json, 'Inspector');
    // 自動コピー
    (async () => {
      try {
        await navigator.clipboard.writeText(json);
        const btn = document.getElementById('jsonCopyBtn');
        if (btn) {
          const org = btn.textContent;
          btn.textContent = 'コピー済み';
          setTimeout(() => { btn.textContent = org || 'コピー'; }, 1500);
        }
      } catch(err) {
        try {
          const ta = document.createElement('textarea');
          ta.value = json; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
        } catch(e) { console.warn('Auto-copy failed'); }
      }
    })();
  } catch(err) { console.error('Inspector failed', err); }
});

// DevTools hover-inspector (button toggle)
(function(){
  const btn = document.getElementById('devToolsBtn');
  if (!btn) return;
  let active = false;
  let overlay, tip;
  function ensureNodes(){
    if (!overlay){ overlay = document.createElement('div'); overlay.className = 'inspect-overlay'; overlay.style.display='none'; document.body.appendChild(overlay); }
    if (!tip){ tip = document.createElement('div'); tip.className = 'inspect-tip'; tip.style.display='none'; document.body.appendChild(tip); }
  }
  function fmtSel(el){
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList?.length ? '.'+Array.from(el.classList).slice(0,2).join('.') : '';
    return `${tag}${id}${cls}`;
  }
  function moveOverlay(target, x, y){
    const rect = target.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    tip.style.display = 'block';
    const comp = window.getComputedStyle(target);
    const color = comp.color; const font = comp.font; const margin = comp.margin;
    tip.innerHTML = `
      <span class="t-path">${fmtSel(target)} <span class="t-mono">${rect.width.toFixed(0)}×${rect.height.toFixed(0)}</span></span>
      <div>Color <span class="t-mono">${color}</span></div>
      <div>Font <span class="t-mono">${font}</span></div>
      <div>Margin <span class="t-mono">${margin}</span></div>
    `;
    const tipW = Math.min(360, Math.max(220, tip.offsetWidth||240));
    let tx = x + 12, ty = y + 12;
    if (tx + tipW > window.innerWidth - 20) tx = x - tipW - 12;
    if (ty + 140 > window.innerHeight - 10) ty = y - 150;
    tip.style.left = `${Math.max(10, tx)}px`;
    tip.style.top = `${Math.max(10, ty)}px`;
  }
  function openInfo(target){
    const json = JSON.stringify(collectElementInfo(target), null, 2);
    openJsonModal(json, 'Inspector');
    (async()=>{ try{ await navigator.clipboard.writeText(json);}catch(_){}})();
  }
  function onMove(e){
    const node = document.elementFromPoint(e.clientX, e.clientY);
    if (!node || node === overlay || tip.contains(node)) return;
    const target = node.closest('body *');
    if (!target) return;
    moveOverlay(target, e.clientX, e.clientY);
  }
  function onClick(e){
    e.preventDefault(); e.stopPropagation();
    const node = document.elementFromPoint(e.clientX, e.clientY);
    if (!node || node === overlay || tip.contains(node)) return;
    const target = node.closest('body *');
    if (!target) return;
    openInfo(target);
  }
  function enable(){ ensureNodes(); active = true; window.__devToolsActive = true; document.body.classList.add('inspect-active'); overlay.style.display='block'; tip.style.display='block'; btn.textContent = 'DevTools: ON'; document.addEventListener('mousemove', onMove, true); document.addEventListener('click', onClick, true); }
  function disable(){ active = false; window.__devToolsActive = false; document.body.classList.remove('inspect-active'); if (overlay) overlay.style.display='none'; if (tip) tip.style.display='none'; btn.textContent = 'DevTools'; document.removeEventListener('mousemove', onMove, true); document.removeEventListener('click', onClick, true); }
  btn.addEventListener('click', () => { active ? disable() : enable(); });
  document.addEventListener('keydown', (e) => { if (active && e.key === 'Escape') disable(); });
})();

// UI遷移図の初期化
function initUIFlow() {
  const nodes = [
    { id: 'welcome', x: 100, y: 100, title: 'Welcome画面', img: '/images/kamui-white-1.png' },
    { id: 'catalog', x: 400, y: 100, title: 'Catalogページ', img: '/images/kamui-white-2.png' },
    { id: 'playlist', x: 700, y: 100, title: 'Playlistページ', img: '/images/kamui-white-3.png' },
    { id: 'docs', x: 400, y: 300, title: 'Document画面', img: '/images/kamui-white-4.png' },
    { id: 'api', x: 700, y: 300, title: 'API実行画面', img: '/images/kamui-white-5.png' }
  ];
  
  const edges = [
    { from: 'welcome', to: 'catalog', label: 'Catalog選択' },
    { from: 'welcome', to: 'playlist', label: 'Playlist選択' },
    { from: 'catalog', to: 'docs', label: 'ドキュメント参照' },
    { from: 'playlist', to: 'api', label: 'API実行' },
    { from: 'docs', to: 'api', label: 'Try it' }
  ];
  
  const flowNodes = document.getElementById('flowNodes');
  const flowSvg = document.getElementById('flowSvg');
  const flowInner = document.getElementById('flowInner');
  const flowViewport = document.getElementById('flowViewport');
  
  if (!flowNodes || !flowSvg) return;
  
  // ノードを配置
  nodes.forEach(node => {
    const div = document.createElement('div');
    div.className = 'flow-node';
    div.id = `node-${node.id}`;
    div.style.left = `${node.x}px`;
    div.style.top = `${node.y}px`;
    div.innerHTML = `
      <img src="${node.img}" alt="${node.title}">
      <div class="title">${node.title}</div>
    `;
    flowNodes.appendChild(div);
  });
  
  // エッジ（矢印）を描画
  const svgNS = 'http://www.w3.org/2000/svg';
  edges.forEach((edge, i) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;
    
    const x1 = fromNode.x + 110;
    const y1 = fromNode.y + 90;
    const x2 = toNode.x + 110;
    const y2 = toNode.y + 90;
    
    const path = document.createElementNS(svgNS, 'path');
    const d = `M ${x1} ${y1} L ${x2} ${y2}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', '#4a9eff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    flowSvg.appendChild(path);
    
    // ラベル
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', midX);
    text.setAttribute('y', midY - 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'flow-label');
    text.textContent = edge.label;
    flowSvg.appendChild(text);
  });
  
  // 矢印マーカー定義
  const defs = document.createElementNS(svgNS, 'defs');
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');
  const polygon = document.createElementNS(svgNS, 'polygon');
  polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
  polygon.setAttribute('fill', '#4a9eff');
  marker.appendChild(polygon);
  defs.appendChild(marker);
  flowSvg.appendChild(defs);
  
  // ズーム機能
  let scale = 1;
  const zoomIn = document.getElementById('flowZoomIn');
  const zoomOut = document.getElementById('flowZoomOut');
  const zoomReset = document.getElementById('flowZoomReset');
  
  function applyZoom(newScale) {
    scale = Math.max(0.5, Math.min(2, newScale));
    flowInner.style.transform = `scale(${scale})`;
  }
  
  zoomIn?.addEventListener('click', () => applyZoom(scale + 0.1));
  zoomOut?.addEventListener('click', () => applyZoom(scale - 0.1));
  zoomReset?.addEventListener('click', () => applyZoom(1));
}

// MCP プレイリスト/カタログ 表示
(async function initMcpSection(){
  const state = { top: 'playlist', cat: 'creative' };
  const btnTop = {
    playlist: document.getElementById('btnMcpPlaylist'),
    catalog: document.getElementById('btnMcpCatalog')
  };
  const btnCat = {
    creative: document.getElementById('btnCatCreative'),
    development: document.getElementById('btnCatDevelopment'),
    business: document.getElementById('btnCatBusiness')
  };
  const table = document.getElementById('mcpTable');
  const thead = table?.querySelector('thead');
  const tbody = table?.querySelector('tbody');
  const msg = document.getElementById('mcpMessage');

  function setActive(){
    Object.values(btnTop).forEach(b=>b?.classList.remove('active'));
    Object.values(btnCat).forEach(b=>b?.classList.remove('active'));
    btnTop[state.top]?.classList.add('active');
    btnCat[state.cat]?.classList.add('active');
  }

  async function loadJson(url, inlineId, fallbackArray){
    let items = [];
    if (location.protocol !== 'file:') {
      try { const res = await fetch(url, { cache: 'no-cache' }); if (res.ok) items = await res.json(); } catch(_) {}
    }
    if (!Array.isArray(items) || items.length===0) {
      const inline = document.getElementById(inlineId);
      if (inline && !inline.textContent && fallbackArray) inline.textContent = JSON.stringify(fallbackArray, null, 2);
      try { items = JSON.parse(document.getElementById(inlineId)?.textContent || '[]'); } catch(_) {}
    }
    return Array.isArray(items)? items: [];
  }

  const playlists = await loadJson('./data/mcp_playlists.json', 'mcpPlaylistsInline', [
    { category:'creative', name:'Creative Base', url:'https://example.com/mcp/creative.json', format:'json', description:'クリエイティブ向けMCPサーバーのプレイリスト' }
  ]);
  const catalogs = await loadJson('./data/mcp_catalog.json', 'mcpCatalogInline', [
    { category:'creative', title:'Creative Servers', url:'https://docs.example.com/catalog/creative', description:'クリエイティブ領域のMCPサーバーカタログ' }
  ]);

  function render(){
    if (!thead || !tbody) return;
    setActive();
    const cat = state.cat;
    if (state.top === 'playlist') {
      thead.innerHTML = `<tr><th>名前</th><th>URL</th><th>形式</th><th>説明</th></tr>`;
      const filtered = playlists.filter(x=>x.category===cat);
      const rows = filtered.map(x=> `
        <tr>
          <td>${escapeHtml(x.name||'')}</td>
          <td><a href="${escapeAttr(x.url||'')}" target="_blank" rel="noopener">${escapeHtml(x.url||'')}</a></td>
          <td><code>${escapeHtml(x.format||'')}</code></td>
          <td>${escapeHtml(x.description||'')}</td>
        </tr>`).join('');
      tbody.innerHTML = rows || `<tr><td colspan="4">該当するプレイリストがありません。</td></tr>`;
      if (msg) msg.textContent = 'MCPプレイリスト（カテゴリ別）';
    } else {
      thead.innerHTML = `<tr><th>ページ</th><th>URL</th><th>説明</th></tr>`;
      const filtered = catalogs.filter(x=>x.category===cat);
      const rows = filtered.map(x=> `
        <tr>
          <td>${escapeHtml(x.title||'')}</td>
          <td><a href="${escapeAttr(x.url||'')}" target="_blank" rel="noopener">${escapeHtml(x.url||'')}</a></td>
          <td>${escapeHtml(x.description||'')}</td>
        </tr>`).join('');
      tbody.innerHTML = rows || `<tr><td colspan="3">該当するカタログページがありません。</td></tr>`;
      if (msg) msg.textContent = 'MCPカタログ（カテゴリ別）';
    }
  }

  btnTop.playlist?.addEventListener('click', ()=>{ state.top='playlist'; render(); });
  btnTop.catalog?.addEventListener('click',  ()=>{ state.top='catalog';  render(); });
  btnCat.creative?.addEventListener('click', ()=>{ state.cat='creative'; render(); });
  btnCat.development?.addEventListener('click', ()=>{ state.cat='development'; render(); });
  btnCat.business?.addEventListener('click', ()=>{ state.cat='business'; render(); });

  render();
})();

// 動的カード生成（サーバーカタログ、パッケージ）
function setCardGradient(card, title){
  const hues = [
    { a: 210, b: 230 }, // 青系
    { a: 280, b: 300 }, // 紫系
    { a: 160, b: 180 }, // 緑系
    { a: 20, b: 40 },   // オレンジ系
    { a: 340, b: 360 }, // 赤系
  ];
  const idx = Math.abs(hashCode(title)) % hues.length;
  const h = hues[idx];
  card.style.setProperty('--card-hue-a', h.a);
  card.style.setProperty('--card-hue-b', h.b);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}

// パッケージカード生成
async function renderPackages(){
  const container = document.getElementById('packageCards');
  if (!container) return;
  const packages = [
    { id: 'mcp-kamui-code', name: 'mcp-kamui-code.json', desc: 'KAMUI CODE 全体定義' },
    { id: 'mcp-requirement', name: 'mcp-requirement.json', desc: '要件定義ツール' },
    { id: 'mcp-storyboard', name: 'mcp-storyboard.json', desc: 'ストーリーボードツール' }
  ];
  packages.forEach(pkg => {
    const card = document.createElement('div');
    card.className = 'card pastel';
    setCardGradient(card, pkg.name);
    card.innerHTML = `
      <div class="card-title">${pkg.name}</div>
      <div style="color: var(--text-weak); font-size: 0.85rem;">${pkg.desc}</div>
    `;
    card.style.cursor = 'pointer';
    card.addEventListener('click', async () => {
      try {
        const res = await fetch(`./mcp/${pkg.id}.json`);
        const json = await res.text();
        openJsonModal(json, pkg.name);
      } catch(e) {
        openJsonModal('{ "error": "Failed to load JSON" }', pkg.name);
      }
    });
    container.appendChild(card);
  });
}

// サーバーカタログカード生成
async function renderServers(){
  const serverContainer = document.getElementById('serverCards');
  if (!serverContainer) return;
  const servers = [
    { category: 'creative', title: 'Text to Image', vendor: 'FAL', url: 'https://example.com/t2i/fal/imagen4/ultra' },
    { category: 'creative', title: 'Image to Video', vendor: 'MiniMax', url: 'https://example.com/i2v/fal/minimax/hailuo-02' },
    { category: 'development', title: 'Code Analysis', vendor: 'Google', url: 'https://example.com/code-analysis/google/gemini' },
    { category: 'business', title: 'Translation', vendor: 'DeepL', url: 'https://example.com/translate/deepl/v2' }
  ];
  servers.forEach(server => {
    const { category, title, vendor, url } = server;
    const pathOnly = url.replace(/^https?:\/\/[^\/]+/, '');
    const card = document.createElement('div');
    card.className = 'card pastel';
    setCardGradient(card, title);
    card.innerHTML = `
      <div class="card-title">${title}</div>
      <span class="badge">${category}</span>
      <span class="badge">${vendor}</span>
      <div class="endpoint">${pathOnly}</div>
    `;
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const usage = buildUsage(category, url);
      openJsonModal(usage, title);
    });
    serverContainer.appendChild(card);
  });
}

// 利用方法テンプレート
function buildUsage(category, url){
  const h = `# 利用方法\n対象: ${url}\nカテゴリ: ${category}\n\n`;
  const tpl = {
    'creative': `curl -X POST "${url}" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"美しい風景","size":"1024x1024"}'`,
    'development': `curl -X POST "${url}" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"function test() { return true; }"}'`,
    'business': `curl -X POST "${url}" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"こんにちは","target_lang":"en"}'`
  };
  const code = tpl[category] || `curl -X POST "${url}" -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"prompt":"..."}'`;
  return h + '```bash\n' + code + '\n```';
}

// クライアントサンプルカード
function initClientSamples() {
  const cards = document.querySelectorAll('[data-sample-id]');
  cards.forEach(card => {
    const sampleId = card.getAttribute('data-sample-id');
    const jsonScript = document.getElementById(sampleId);
    if (!jsonScript) return;
    
    // ダミーデータをセット
    const dummyData = {
      'client-codex': { mcpServers: { 'kamui-creative': {}, 'kamui-dev': {} } },
      'client-claude': { mcpServers: { 'kamui-creative': {}, 'kamui-dev': {}, 'kamui-business': {} } },
      'client-claude-command': { mcpServers: { 'kamui-dev': {} } },
      'client-gemini': { mcpServers: { 'kamui-creative': {}, 'kamui-business': {} } }
    };
    
    const data = dummyData[sampleId] || {};
    jsonScript.textContent = JSON.stringify(data, null, 2);
    
    // サーバー数を更新
    const count = Object.keys(data.mcpServers || {}).length;
    const countEl = card.querySelector('.endpoint');
    if (countEl) countEl.textContent = `サーバー定義数: ${count}`;
    
    // カードグラデーション設定
    setCardGradient(card, card.querySelector('.card-title')?.textContent || '');
    
    // イベントリスナー
    const openBtn = card.querySelector('[data-open-client]');
    const copyBtn = card.querySelector('[data-copy-client]');
    
    openBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openJsonModal(jsonScript.textContent, card.querySelector('.card-title')?.textContent || 'サンプル');
    });
    
    copyBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(jsonScript.textContent);
        copyBtn.textContent = 'コピー済み';
        setTimeout(() => { copyBtn.textContent = 'コピー'; }, 1500);
      } catch(err) {
        console.error('コピーに失敗:', err);
      }
    });
    
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      openJsonModal(jsonScript.textContent, card.querySelector('.card-title')?.textContent || 'サンプル');
    });
  });
}

// 画像クリックで拡大
function initImageModals() {
  document.querySelectorAll('.media-grid img, .section-image img, .clickable-img img').forEach((img) => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      const parent = img.closest('.media-item');
      const title = parent?.querySelector('.media-name')?.textContent || img.getAttribute('alt');
      openImgModal(img.getAttribute('src'), title);
    });
  });
}

// 右クリックメニュー
function initContextMenu() {
  const contextMenu = document.createElement('div');
  contextMenu.id = 'custom-context-menu';
  contextMenu.style.cssText = `
    position: fixed;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    display: none;
    min-width: 180px;
  `;
  contextMenu.innerHTML = `
    <div id="copy-path-btn" style="padding: 8px 12px; cursor: pointer; border-radius: 4px; font-size: 0.9rem; color: var(--text);">
      📋 相対パスをコピー
    </div>
  `;
  document.body.appendChild(contextMenu);
  
  let currentPath = '';
  
  document.querySelectorAll('.media-item[data-path]').forEach(item => {
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      currentPath = item.getAttribute('data-path');
      
      contextMenu.style.display = 'block';
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
      
      const rect = contextMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        contextMenu.style.left = (window.innerWidth - rect.width - 10) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = (window.innerHeight - rect.height - 10) + 'px';
      }
    });
  });
  
  document.getElementById('copy-path-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentPath);
      const btn = document.getElementById('copy-path-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ コピーしました！';
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 1500);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
    }
    contextMenu.style.display = 'none';
  });
  
  document.getElementById('copy-path-btn').addEventListener('mouseenter', (e) => {
    e.target.style.background = 'var(--hover)';
  });
  document.getElementById('copy-path-btn').addEventListener('mouseleave', (e) => {
    e.target.style.background = 'transparent';
  });
  
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.style.display = 'none';
    }
  });
}

// メニュー一覧の動的生成
async function initDocMenuTable() {
  const menuTable = document.getElementById('docMenuTable');
  if (!menuTable) return;
  
  const tbody = menuTable.querySelector('tbody');
  const messageDiv = document.getElementById('docMenuMessage');
  
  try {
    let menuData = [];
    
    // JSONファイルから読み込み
    try {
      const res = await fetch('/data/kamui-doc-menus.json', { cache: 'no-cache' });
      if (res.ok) {
        menuData = await res.json();
      }
    } catch (e) {
      console.log('JSONファイルの読み込みに失敗しました:', e);
    }
    
    // データが取得できない場合はフォールバック
    if (!Array.isArray(menuData) || menuData.length === 0) {
      // インラインフォールバックデータ
      menuData = [
        { id:'home', label:'ホーム', type:'menu', path:'/', parentId:null, order:0, description:'KAMUI CODE ドキュメントのホーム' },
        { id:'welcome', label:'はじめまして', type:'menu', path:'/welcome', parentId:null, order:0.2, description:'初めての方向けの案内' },
        { id: 'mcp-playlist', label:'MCPプレイリスト', type:'group', path:'/playlist', parentId:null, order:1, description:'MCPサーバーURLのプレイリスト（最上位）' },
        { id: 'playlist-all', label:'プレイリスト一覧', type:'menu', path:'/playlist/all', parentId:'mcp-playlist', order:1.01, description:'プレイリストIDの一覧と検索' },
        { id: 'playlist-creative', label:'プレイリスト（クリエイティブ）', type:'menu', path:'/playlist/creative', parentId:'mcp-playlist', order:1.10, description:'クリエイティブ向けプレイリスト' },
        { id: 'playlist-development', label:'プレイリスト（開発）', type:'menu', path:'/playlist/development', parentId:'mcp-playlist', order:1.20, description:'開発向けプレイリスト' },
        { id: 'playlist-business', label:'プレイリスト（ビジネス）', type:'menu', path:'/playlist/business', parentId:'mcp-playlist', order:1.30, description:'ビジネス向けプレイリスト' },
        { id: 'mcp-catalog', label:'MCPカタログ', type:'group', path:'/catalog', parentId:null, order:2, description:'MCPサーバー/パッケージのカタログ' },
        { id: 'catalog-all', label:'カタログ一覧', type:'menu', path:'/catalog/all', parentId:'mcp-catalog', order:2.01, description:'カタログIDの一覧と検索' },
        { id: 'catalog-creative', label:'カタログ（クリエイティブ）', type:'menu', path:'/catalog/creative', parentId:'mcp-catalog', order:2.10, description:'クリエイティブ領域のカタログ' },
        { id: 'catalog-development', label:'カタログ（開発）', type:'menu', path:'/catalog/development', parentId:'mcp-catalog', order:2.20, description:'開発領域のカタログ' },
        { id: 'catalog-business', label:'カタログ（ビジネス）', type:'menu', path:'/catalog/business', parentId:'mcp-catalog', order:2.30, description:'ビジネス領域のカタログ' }
      ];
    }
    
    if (menuData.length > 0) {
      tbody.innerHTML = ''; // 既存の行をクリア
      menuData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.label || ''}</td>
          <td>${item.id || ''}</td>
          <td>${item.type || ''}</td>
          <td>${item.path || ''}</td>
          <td>${item.parentId || ''}</td>
          <td>${item.order || ''}</td>
          <td>${item.description || ''}</td>
        `;
        tbody.appendChild(row);
      });
      
      if (messageDiv) {
        messageDiv.textContent = `メニュー項目: ${menuData.length}件`;
      }
    }
  } catch (error) {
    console.error('メニューテーブルの初期化エラー:', error);
    if (messageDiv) {
      messageDiv.textContent = 'メニューデータの読み込みに失敗しました。';
    }
  }
}

  // 右下フローティング AIエージェント タスクボード（フロントのみ・ローカルストレージ永続化）
  function initTaskBoard(){
    try {
      if (window.__aiTaskBoardInit) return;
      window.__aiTaskBoardInit = true;
      if (document.getElementById('aiTaskBoard') || document.querySelector('.taskboard-toggle')) return;

      const STORAGE_KEY = 'kamui_task_board_v1';
      const state = { open: false, tasks: [], lastFetchAt: null, backendBase: 'http://localhost:7777', mcpTools: [] };
    const params = new URLSearchParams(location.search);
    const queryBackend = params.get('backend');
    if (typeof window.KAMUI_BACKEND_BASE === 'string' && window.KAMUI_BACKEND_BASE) state.backendBase = window.KAMUI_BACKEND_BASE;
    else if (queryBackend) state.backendBase = queryBackend;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (typeof saved.open === 'boolean') state.open = saved.open;
        }
      }
    } catch(_) {}
    function saveOpen(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ open: state.open })); } catch(_) {} }

    // 要素生成
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'taskboard-toggle';
    toggleBtn.setAttribute('aria-label', 'AIエージェント タスクを開く');
    toggleBtn.setAttribute('title', 'AIエージェント タスク');
    // SVGイルカアイコン（淡い水色）
    toggleBtn.innerHTML = `
      <svg class="bot-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="dolphinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#bfe7ff"/>
            <stop offset="100%" stop-color="#88d1ff"/>
          </linearGradient>
        </defs>
        <path d="M12 3c3.1 0 5.4 1 7 3c.9 1.1 1.3 2.3 1.4 3c-1.2-.4-2.7-.8-4.3-.8c-2.4 0-4.6.8-6.3 2.2c-1 .8-1.9 1.7-2.5 2.7c-.3.5-.9.6-1.4.5c-.9-.2-1.8-.7-2.7-1.3c.4 1.4 1.1 2.4 2.1 3.2c-.5.7-.8 1.4-.9 2.1c1-.1 2.2-.5 3.3-1.1c1.2 1.5 3.2 2.4 5.4 2.4c3.9 0 7-2.6 8.1-5.8c1.2-.2 2.2-.1 3 .1c-.8-1.8-2.4-3.4-4.9-4.6C18.1 4.6 15.6 3 12 3z" fill="url(#dolphinGrad)" opacity="0.95"/>
        <circle cx="16" cy="8.8" r="0.7" fill="#1d4ed8"/>
      </svg>`;

    const panel = document.createElement('div');
    panel.id = 'aiTaskBoard';
    panel.className = 'taskboard-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-hidden', state.open ? 'false' : 'true');

    panel.innerHTML = `
      <div class="taskboard-header">
        <div class="tb-title">AIエージェント タスク</div>
        <div class="tb-actions">
          <button type="button" class="tb-btn tb-hide" aria-label="閉じる" title="閉じる">×</button>
        </div>
      </div>
      <div class="taskboard-list" id="taskboardList" aria-live="polite"></div>
      <div class="taskboard-compose">
        <div style="position:relative;flex:1;">
          <input type="text" id="taskboardInput" class="tb-input" placeholder="新規タスクを入力... (/でMCPダイヤルを開く、Enterで追加)" autocomplete="off" />
        </div>
        <button type="button" id="taskboardSend" class="tb-send" aria-label="送信">送信</button>
      </div>
    `;

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    const listEl = panel.querySelector('#taskboardList');
    const inputEl = panel.querySelector('#taskboardInput');
    const sendEl  = panel.querySelector('#taskboardSend');
    const hideEl  = panel.querySelector('.tb-hide');
    // Create a global dial overlay for MCP tools
    let dialOverlay = document.getElementById('mcpDialOverlay');
    if (!dialOverlay) {
      dialOverlay = document.createElement('div');
      dialOverlay.id = 'mcpDialOverlay';
      dialOverlay.className = 'mcp-dial-overlay';
      
      const dialContainer = document.createElement('div');
      dialContainer.className = 'mcp-dial-container';
      
      // 3D回転ラッパー
      const itemsWrapper = document.createElement('div');
      itemsWrapper.className = 'mcp-dial-items-wrapper';
      dialContainer.appendChild(itemsWrapper);
      
      // 3D軌道エフェクト（オプション）
      const orbit3D = document.createElement('div');
      orbit3D.className = 'mcp-dial-orbit-3d';
      itemsWrapper.appendChild(orbit3D);
      
      // 中央の入力エリア
      const center = document.createElement('div');
      center.className = 'mcp-dial-center';
      center.innerHTML = `
        <input type="text" class="mcp-dial-input" id="mcpDialInput" placeholder="ツールを検索..." autocomplete="off" />
        <div class="mcp-dial-hint">クリックまたはEnterで選択</div>
      `;
      dialContainer.appendChild(center);
      
      // ツールアイテムコンテナ
      const itemsContainer = document.createElement('div');
      itemsContainer.id = 'mcpDialItems';
      itemsContainer.className = 'mcp-dial-items';
      itemsWrapper.appendChild(itemsContainer);
      
      // 閉じるボタン
      const closeBtn = document.createElement('button');
      closeBtn.className = 'mcp-dial-close';
      closeBtn.innerHTML = '×';
      closeBtn.setAttribute('aria-label', '閉じる');
      
      dialOverlay.appendChild(dialContainer);
      dialOverlay.appendChild(closeBtn);
      document.body.appendChild(dialOverlay);
      
      // イベントリスナー
      closeBtn.addEventListener('click', () => {
        dialOverlay.classList.remove('active');
        if (inputEl) inputEl.focus();
      });
      
      dialOverlay.addEventListener('click', (e) => {
        if (e.target === dialOverlay) {
          dialOverlay.classList.remove('active');
          if (inputEl) inputEl.focus();
        }
      });
      
      // ダイヤル内の入力欄のイベント
      const dialInput = center.querySelector('#mcpDialInput');
      dialInput?.addEventListener('input', (e) => {
        const value = e.target.value;
        updateDialItems(value);
      });
      
      let dialActiveIndex = 0;
      dialInput?.addEventListener('keydown', (e) => {
        const items = Array.from(dialOverlay.querySelectorAll('.mcp-dial-item'));
        
        if (e.key === 'Escape') {
          dialOverlay.classList.remove('active');
          if (inputEl) inputEl.focus();
        } else if (e.key === 'Enter') {
          const activeItem = dialOverlay.querySelector('.mcp-dial-item.active');
          if (activeItem) {
            activeItem.click();
          }
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          if (items.length > 0) {
            dialActiveIndex = (dialActiveIndex + 1) % items.length;
            items.forEach((item, i) => {
              item.classList.toggle('active', i === dialActiveIndex);
            });
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (items.length > 0) {
            dialActiveIndex = (dialActiveIndex - 1 + items.length) % items.length;
            items.forEach((item, i) => {
              item.classList.toggle('active', i === dialActiveIndex);
            });
          }
        }
      });
    }

    async function probeBackendBase(){
      const candidates = [];
      const add = (s) => { if (s && !candidates.includes(s)) candidates.push(s); };
      // 優先: 明示指定
      add(state.backendBase);
      // 典型候補（Node.jsサーバーを最優先）
      add('http://localhost:7777');
      add('http://127.0.0.1:7777');
      add('/backend');
      add('http://localhost:3001/backend');
      add('http://127.0.0.1:3001/backend');
      for (const base of candidates) {
        try {
          const url = base.replace(/\/$/, '') + '/api/config';
          const res = await fetch(url, { cache: 'no-cache', mode: 'cors' });
          if (res.ok) { state.backendBase = base; return base; }
        } catch(_) {}
      }
      return state.backendBase;
    }

    // MCPツールの詳細情報マッピング（submit情報など）
    const mcpToolDetails = {
      'file-upload-kamui-fal': {
        endpoint: '/uploader/fal',
        method: 'POST',
        params: 'ファイルをmultipart/form-dataで送信',
        example: 'curl -X POST -F "file=@image.jpg" {BASE_URL}/uploader/fal'
      },
      't2i-kamui-flux-schnell': {
        endpoint: '/t2i/fal/flux/schnell',
        method: 'POST',
        params: 'prompt: 画像生成プロンプト（高速）',
        example: '{"prompt": "サイバーパンクな東京の夜景"}'
      },
      't2i-kamui-flux-krea-lora': {
        endpoint: '/t2i/fal/flux-krea-lora',
        method: 'POST',
        params: 'prompt: 画像生成プロンプト, lora_scale: LoRA強度',
        example: '{"prompt": "アニメスタイルのキャラクター", "lora_scale": 0.8}'
      },
      't2i-kamui-dreamina-v31': {
        endpoint: '/t2i/fal/bytedance/dreamina/v3.1/text-to-image',
        method: 'POST',
        params: 'prompt: 画像生成プロンプト, style: スタイル指定',
        example: '{"prompt": "油絵風の風景画", "style": "oil-painting"}'
      },
      't2i-kamui-imagen3': {
        endpoint: '/t2i/google/imagen',
        method: 'POST',
        params: 'prompt: 画像生成プロンプト（Google Imagen）',
        example: '{"prompt": "フォトリアルな花の写真"}'
      },
      't2i-kamui-imagen4-fast': {
        endpoint: '/t2i/fal/imagen4/fast',
        method: 'POST',
        params: 'prompt: 画像生成プロンプト, size: 画像サイズ（オプション）',
        example: '{"prompt": "富士山の美しい写真", "size": "1024x1024"}'
      },
      't2i-kamui-imagen4-ultra': {
        endpoint: '/t2i/fal/imagen4/ultra',
        method: 'POST',
        params: 'prompt: 画像生成プロンプト（高品質）, size: 画像サイズ',
        example: '{"prompt": "詳細な富士山の風景画", "size": "2048x2048"}'
      },
      't2i-kamui-ideogram-character-base': {
        endpoint: '/t2i/fal/ideogram/character-base',
        method: 'POST',
        params: 'prompt: キャラクター説明, consistency_mode: 一貫性モード',
        example: '{"prompt": "勇敢な女性戦士", "consistency_mode": true}'
      },
      't2v-kamui-veo3-fast': {
        endpoint: '/t2v/fal/veo3/fast',
        method: 'POST',
        params: 'prompt: ビデオ生成プロンプト, duration: 長さ（秒）',
        example: '{"prompt": "走る猫のアニメーション", "duration": 5}'
      },
      't2v-kamui-wan-v2-2-5b-fast': {
        endpoint: '/t2v/fal/wan/v2.2-5b/text-to-video/fast-wan',
        method: 'POST',
        params: 'prompt: ビデオ生成プロンプト, fps: フレームレート',
        example: '{"prompt": "空を飛ぶ鳥", "fps": 24}'
      },
      'i2i-kamui-aura-sr': {
        endpoint: '/i2i/fal/aura-sr',
        method: 'POST',
        params: 'image_url: 元画像URL, scale: 拡大倍率',
        example: '{"image_url": "https://example.com/image.jpg", "scale": 4}'
      },
      'i2i-kamui-flux-kontext-lora': {
        endpoint: '/i2i/fal/flux/kontext',
        method: 'POST',
        params: 'image_url: 元画像URL, prompt: 編集指示',
        example: '{"image_url": "base64://...", "prompt": "背景を夕焼けに変更"}'
      },
      'i2i-kamui-ideogram-character-remix': {
        endpoint: '/i2i/fal/ideogram/character-remix',
        method: 'POST',
        params: 'image_url: キャラクター画像, style: 新しいスタイル',
        example: '{"image_url": "base64://...", "style": "cyberpunk"}'
      },
      'i2i-kamui-qwen-image-edit': {
        endpoint: '/i2i/fal/qwen/image-edit',
        method: 'POST',
        params: 'image_url: 元画像, prompt: 編集指示',
        example: '{"image_url": "base64://...", "prompt": "人物を削除して背景のみに"}'
      },
      'train-kamui-flux-kontext': {
        endpoint: '/train/fal/flux/kontext',
        method: 'POST',
        params: 'images: 学習画像配列, model_name: モデル名',
        example: '{"images": ["url1", "url2"], "model_name": "my-style"}'
      },
      'video-analysis-kamui': {
        endpoint: '/video-analysis/google/gemini',
        method: 'POST',
        params: 'video_url: ビデオURL, prompt: 分析指示',
        example: '{"video_url": "https://example.com/video.mp4", "prompt": "このビデオの要約を作成"}'
      }
    };

    async function loadMCPTools(){
      // バックエンド（Node.jsサーバー）から、現在参照中のMCP定義を取得
      try {
        const backendBase = await probeBackendBase();
        const res = await fetch(`${backendBase.replace(/\/$/, '')}/api/claude/mcp/servers`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const servers = Array.isArray(data.servers) ? data.servers : [];
        // ツール配列に正規化（name/description + 詳細情報）
        state.mcpTools = servers.map((s, idx) => {
          const toolName = String(s.name || `tool-${idx+1}`);
          const details = mcpToolDetails[toolName] || {};
          return {
            name: toolName,
            description: String(s.description || s.url || ''),
            icon: guessIconFromName(toolName),
            color: guessColorFromName(toolName),
            // 詳細情報を追加
            endpoint: details.endpoint || '',
            method: details.method || 'POST',
            params: details.params || '',
            example: details.example || ''
          };
        });
      } catch(err) {
        console.warn('Failed to load MCP tools from backend:', err);
        state.mcpTools = [];
      }
    }

    function guessIconFromName(name){
      const n = name.toLowerCase();
      if (n.startsWith('t2i') || n.includes('image')) return 'IMG';
      if (n.startsWith('t2m') || n.includes('music')) return 'MUS';
      if (n.startsWith('t2v') || n.includes('video')) return 'VID';
      if (n.includes('visual') || n.includes('diagram')) return 'VIS';
      if (n.includes('search') || n.includes('crawl')) return 'WEB';
      if (n.includes('editor')) return 'EDT';
      return 'APP';
    }
    
    // カテゴリごとの色定義
    function getCategoryColors(cat) {
      const colors = {
        IMG: { bg: '#FF6B6B', icon: 'https://cdn-icons-png.flaticon.com/512/3342/3342137.png' }, // 赤系 - 画像
        VID: { bg: '#4ECDC4', icon: 'https://cdn-icons-png.flaticon.com/512/3179/3179068.png' }, // ターコイズ - 動画
        MUS: { bg: '#95E1D3', icon: 'https://cdn-icons-png.flaticon.com/512/3141/3141766.png' }, // ミント - 音楽
        VIS: { bg: '#A8E6CF', icon: 'https://cdn-icons-png.flaticon.com/512/2329/2329087.png' }, // ライトグリーン - ビジュアル
        WEB: { bg: '#5B9FFF', icon: 'https://cdn-icons-png.flaticon.com/512/2991/2991114.png' }, // ブルー - ウェブ
        EDT: { bg: '#C7A8FF', icon: 'https://cdn-icons-png.flaticon.com/512/2920/2920242.png' }, // パープル - エディタ
        APP: { bg: '#FFD93D', icon: 'https://cdn-icons-png.flaticon.com/512/3573/3573187.png' }  // イエロー - アプリ
      };
      return colors[cat] || colors.APP;
    }

    function svgForCategory(cat, color){
      const c = color || '#4a9eff';
      const common = (child) => `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity=".95"/><stop offset="100%" stop-color="${c}" stop-opacity=".75"/></linearGradient></defs>${child}</svg>`;
      switch (cat) {
        case 'IMG':
          return common(`<rect x="6" y="8" width="28" height="24" rx="6" fill="url(#g)"/><path d="M10 26l7-7 6 6 5-5 6 6v6H10z" fill="#fff" opacity=".9"/>`);
        case 'VID':
          return common(`<rect x="6" y="8" width="28" height="24" rx="6" fill="url(#g)"/><polygon points="16,16 28,20 16,24" fill="#fff" opacity=".9"/>`);
        case 'MUS':
          return common(`<rect x="6" y="8" width="28" height="24" rx="6" fill="url(#g)"/><path d="M22 14v10a3 3 0 1 1-2-2.8V16l8-2v6a3 3 0 1 1-2-2.8V12l-6 2z" fill="#fff" opacity=".9"/>`);
        case 'VIS':
          return common(`<rect x="6" y="8" width="28" height="24" rx="6" fill="url(#g)"/><circle cx="20" cy="20" r="6" fill="none" stroke="#fff" stroke-width="2"/><path d="M8 20c3-5 7-8 12-8s9 3 12 8c-3 5-7 8-12 8s-9-3-12-8z" fill="none" stroke="#fff" stroke-width="2" opacity=".9"/>`);
        case 'WEB':
          return common(`<rect x="6" y="8" width="28" height="24" rx="6" fill="url(#g)"/><circle cx="20" cy="20" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 20h16M20 12c4 4 4 12 0 16c-4-4-4-12 0-16z" stroke="#fff" stroke-width="2" fill="none"/>`);
        case 'EDT':
          return common(`<rect x="6" y="8" width="28" height="24" rx="6" fill="url(#g)"/><path d="M14 26l12-12 2 2-12 12H14v-2z" fill="#fff" opacity=".9"/><path d="M24 12l2 2" stroke="#fff" stroke-width="2"/>`);
        default:
          return common(`<rect x="6" y="8" width="28" height="24" rx="6" fill="url(#g)"/><path d="M14 16h12v12H14z" fill="#fff" opacity=".9"/>`);
      }
    }

    function guessColorFromName(name){
      const palette = ['#4A90E2','#7ED321','#F5A623','#BD10E0','#50E3C2','#B8E986','#F8E71C','#D0021B','#9013FE','#417505'];
      let hash = 0; for (let i=0;i<name.length;i++){ hash = (hash*31 + name.charCodeAt(i))>>>0; }
      return palette[hash % palette.length];
    }
    
    // 円形ダイヤルにツールを配置する関数
    function updateDialItems(searchQuery = ''){
      const itemsContainer = document.getElementById('mcpDialItems');
      if (!itemsContainer || !dialOverlay) return;
      
      const q = searchQuery.toLowerCase();
      const filtered = q === '' ? state.mcpTools : state.mcpTools.filter(tool => 
        tool.name.toLowerCase().includes(q) || 
        (tool.description && tool.description.toLowerCase().includes(q))
      );
      
      // 既存のアイテムをクリア
      itemsContainer.innerHTML = '';
      
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text-weak);';
        empty.textContent = 'ツールが見つかりません';
        itemsContainer.appendChild(empty);
        return;
      }
      
      // 円周上の配置を計算（レスポンシブ対応）
      const containerSize = window.innerWidth < 768 ? 600 : 900;
      const itemCount = filtered.length;
      
      // ツール数に応じて半径とアイテムサイズを動的に調整
      let radius, itemSize, sizeClass;
      if (itemCount <= 6) {
        radius = window.innerWidth < 768 ? 200 : 300;
        itemSize = window.innerWidth < 768 ? 120 : 150;
        sizeClass = '';
      } else if (itemCount <= 12) {
        radius = window.innerWidth < 768 ? 220 : 330;
        itemSize = window.innerWidth < 768 ? 110 : 140;
        sizeClass = 'size-medium';
      } else if (itemCount <= 20) {
        radius = window.innerWidth < 768 ? 240 : 360;
        itemSize = window.innerWidth < 768 ? 100 : 130;
        sizeClass = 'size-small';
      } else {
        // 20個以上の場合は2重円にする
        radius = window.innerWidth < 768 ? 230 : 350;
        itemSize = window.innerWidth < 768 ? 100 : 120;
        sizeClass = 'size-small';
      }
      
      const centerX = containerSize / 2; // コンテナの中心X
      const centerY = containerSize / 2; // コンテナの中心Y
      const angleStep = (2 * Math.PI) / Math.min(itemCount, 20); // 最大20個まで外円に配置
      const startAngle = -Math.PI / 2; // 上から開始
      
      filtered.forEach((tool, index) => {
        let angle, x, y, currentRadius;
        
        // 20個以上の場合は内側の円にも配置
        if (itemCount > 20 && index >= 20) {
          const innerIndex = index - 20;
          const innerCount = itemCount - 20;
          const innerAngleStep = (2 * Math.PI) / innerCount;
          currentRadius = radius * 0.6; // 内側の円は60%の半径
          angle = startAngle + innerAngleStep * innerIndex;
        } else {
          angle = startAngle + angleStep * index;
          currentRadius = radius;
        }
        
        // 円形配置の座標計算
        x = centerX + currentRadius * Math.cos(angle);
        y = centerY + currentRadius * Math.sin(angle);
        
        const item = document.createElement('div');
        const isInnerCircle = itemCount > 20 && index >= 20;
        const classes = ['mcp-dial-item', sizeClass];
        if (isInnerCircle) classes.push('inner-circle');
        item.className = classes.filter(Boolean).join(' ');
        item.style.width = `${itemSize}px`;
        item.style.height = `${itemSize}px`;
        item.style.left = `${x}px`;
        item.style.top = `${y}px`;
        
        // アニメーションを遅延
        item.style.animationDelay = `${index * 0.05}s`;
        item.setAttribute('data-tool', tool.name);
        
        // 3D配置のための角度を保存（CSSで使用）
        const angleDeg = (angle * 180 / Math.PI);
        item.setAttribute('data-angle', angleDeg);
        item.style.setProperty('--rotation', `${angleDeg}deg`);
        
        const iconCat = guessIconFromName(tool.name);
        const categoryInfo = getCategoryColors(iconCat);
        
        // 詳細なツールチップ内容を構築
        let tooltipContent = escapeHtml(tool.description);
        if (tool.endpoint || tool.params || tool.example) {
          tooltipContent = `
            <div class="mcp-tooltip-content">
              <div class="mcp-tooltip-desc">${escapeHtml(tool.description)}</div>
              ${tool.endpoint ? `<div class="mcp-tooltip-section"><strong>エンドポイント:</strong> ${tool.method} ${escapeHtml(tool.endpoint)}</div>` : ''}
              ${tool.params ? `<div class="mcp-tooltip-section"><strong>パラメータ:</strong><br>${escapeHtml(tool.params)}</div>` : ''}
              ${tool.example ? `<div class="mcp-tooltip-section"><strong>使用例:</strong><br><code>${escapeHtml(tool.example)}</code></div>` : ''}
            </div>
          `;
        }
        
        item.innerHTML = `
          <div class="mcp-dial-item-inner">
            <div class="mcp-dial-icon" style="background: ${categoryInfo.bg};">
              <img src="${categoryInfo.icon}" style="width: 80%; height: 80%; object-fit: contain; filter: brightness(0) invert(1);" />
            </div>
            <div class="mcp-dial-label">${escapeHtml(tool.name)}</div>
            ${tool.description ? `<div class="mcp-dial-tooltip">${tooltipContent}</div>` : ''}
          </div>
        `;
        
        // クリックイベント
        item.addEventListener('click', () => {
          item.classList.add('selected');
          setTimeout(() => {
            if (inputEl) {
              inputEl.value = `${tool.description || tool.name}して`;
              inputEl.focus();
            }
            dialOverlay.classList.remove('active');
          }, 300);
        });
        
        // ホバー効果
        item.addEventListener('mouseenter', () => {
          // 他のアクティブ状態をクリア
          itemsContainer.querySelectorAll('.mcp-dial-item').forEach(el => {
            el.classList.remove('active');
          });
          item.classList.add('active');
        });
        
        itemsContainer.appendChild(item);
      });
      
      // 最初のアイテムをアクティブに
      const firstItem = itemsContainer.querySelector('.mcp-dial-item');
      if (firstItem) firstItem.classList.add('active');
    }
    
    // 円形ダイヤルを表示する関数
    function showMCPDial(){
      if (!dialOverlay) return;
      dialOverlay.classList.add('active');
      const dialInput = document.getElementById('mcpDialInput');
      if (dialInput) {
        dialInput.value = '';
        setTimeout(() => dialInput.focus(), 100);
      }
      updateDialItems('');
    }

    function cssStatus(s){
      if (s === 'running') return 'doing';
      if (s === 'completed') return 'done';
      if (s === 'failed') return 'done';
      return 'todo';
    }
    function iconFor(s){
      if (s === 'running') return '⏳';
      if (s === 'completed') return '✔';
      if (s === 'failed') return '×';
      return '';
    }
    function mergeTask(task){
      const id = String(task.id);
      const idx = state.tasks.findIndex(x => String(x.id) === id);
      if (idx >= 0) state.tasks[idx] = task; else state.tasks.unshift(task);
      state.tasks.sort((a,b)=>new Date(b.createdAt||0) - new Date(a.createdAt||0));
    }
    async function submitRemoteTask(text){
      const prompt = String(text||'').trim();
      if (!prompt) return;
      const now = new Date().toISOString();
      const tempId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const task = { id: tempId, status: 'running', prompt, createdAt: now, updatedAt: now, response: '', result: null, error: null };
      mergeTask(task);
      render();
      try {
        const base = await probeBackendBase();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分のタイムアウト
        
        const res = await fetch(`${base.replace(/\/$/, '')}/api/claude/chat`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ prompt }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error(`submit failed (${res.status})`);
        const data = await res.json();
        task.status = 'completed';
        task.response = data && typeof data.response === 'string' ? data.response : '';
        task.result = data && data.result ? data.result : null;
        task.updatedAt = new Date().toISOString();
      } catch(err) {
        task.status = 'failed';
        if (err.name === 'AbortError') {
          task.error = 'タイムアウト: 処理に時間がかかりすぎました（5分以上）';
        } else {
          task.error = String(err && err.message || err);
        }
        task.updatedAt = new Date().toISOString();
      }
      mergeTask(task);
      render();
    }

    function render(){
      if (!listEl) return;
      if (!Array.isArray(state.tasks) || state.tasks.length === 0){
        listEl.innerHTML = `<div class="tb-empty">タスクはありません。チャット欄から追加してください。</div>`;
        return;
      }
      const html = state.tasks.map(t => {
        const s = t.status || 'running';
        const cls = cssStatus(s);
        const icon = iconFor(s);
        const title = escapeHtml(t.prompt || '');
        const responseText = String(t.response || '');
        const urlMatches = responseText.matchAll(/https?:\/\/[^\s`]+/g);
        const pathMatches = responseText.matchAll(/\/(?:Users|home)\/[^\s`]+/g);
        const items = [];
        
        // URL検出
        for (const match of urlMatches) {
          const url = match[0].replace(/[.,;]+$/, '');
          if (!items.some(item => item.includes(encodeURIComponent(url)))) {
            items.push(`<span class="tb-meta-item" data-action="open-url" title="リンクを開く" data-url="${encodeURIComponent(url)}" style="display:inline-flex;align-items:center;gap:4px;margin-right:8px;cursor:pointer;padding:4px;border-radius:4px;background:rgba(74,158,255,0.1);transition:background 0.2s;">
              <svg width="16" height="16" viewBox="0 0 24 24" class="tb-meta-icon" aria-hidden="true" style="color:#4a9eff;"><path fill="currentColor" d="M10 3H3v7h2V6.41l9.29 9.3l1.42-1.42l-9.3-9.29H10V3Zm4 0v2h3.59l-9.3 9.29l1.42 1.42l9.29-9.3V13h2V3h-7ZM5 14v7h7v-2H7v-5H5Zm12 5h-3v2h7v-7h-2v5Z"/></svg>
            </span>`);
          }
        }
        
        // パス検出（ファイルとフォルダを判別）
        const addedPaths = new Set();
        const addedDirs = new Set();
        
        for (const match of pathMatches) {
          const path = match[0].replace(/[.,;]+$/, '');
          
          if (!addedPaths.has(path)) {
            addedPaths.add(path);
            
            // ファイルとして扱う（デフォルト）
            items.push(`<span class="tb-meta-item" data-action="open-file" title="ファイルを開く" data-path="${encodeURIComponent(path)}" style="display:inline-flex;align-items:center;gap:4px;margin-right:8px;cursor:pointer;padding:4px;border-radius:4px;background:rgba(74,158,255,0.1);transition:background 0.2s;">
              <svg width="16" height="16" viewBox="0 0 24 24" class="tb-meta-icon" aria-hidden="true" style="color:#4a9eff;"><path fill="currentColor" d="M6 2a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm7 1.5L18.5 9H13V3.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z"/></svg>
            </span>`);
            
            // ファイルパスからディレクトリパスを抽出してフォルダアイコンも追加
            const lastSlash = path.lastIndexOf('/');
            if (lastSlash > 0) {
              const dirPath = path.substring(0, lastSlash);
              if (!addedDirs.has(dirPath)) {
                addedDirs.add(dirPath);
                items.push(`<span class="tb-meta-item" data-action="open-folder" title="フォルダを開く" data-path="${encodeURIComponent(dirPath)}" style="display:inline-flex;align-items:center;gap:4px;margin-right:8px;cursor:pointer;padding:4px;border-radius:4px;background:rgba(74,158,255,0.1);transition:background 0.2s;">
                  <svg width="16" height="16" viewBox="0 0 24 24" class="tb-meta-icon" aria-hidden="true" style="color:#4a9eff;"><path fill="currentColor" d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2Z"/></svg>
                </span>`);
              }
            }
          }
        }
        
        const createdAt = t.createdAt ? new Date(t.createdAt).getTime() : Date.now();
        const elapsed = Date.now() - createdAt;
        const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / 300000) * 100)));
        const showProgress = s === 'running';
        
        // 経過時間に応じてステータステキストを変更
        let statusText = '';
        if (showProgress) {
          if (elapsed < 60000) {
            statusText = 'プロンプトを強化しています...';
          } else if (elapsed < 180000) {
            statusText = '生成中です...';
          } else {
            statusText = '処理に時間がかかっています...';
          }
        } else if (!items.length) {
          statusText = t.error ? String(t.error) : s;
        }
        
        return `
          <div class="task-item ${cls}" data-id="${String(t.id)}">
            <button class="task-status ${cls}" data-action="open" title="詳細を表示">
              <span class="i">${icon}</span>
            </button>
            <div class="task-text">
              <div>${title}</div>
              <div class="tb-meta" style="font-size:.75rem;color:var(--text-weak);margin-top:3px;">
                ${statusText ? `<span class="tb-meta-text" style="display:inline-block;opacity:0.8;margin-right:8px;">${escapeHtml(statusText)}</span>` : ''}
                ${items.join('')}
              </div>
              ${showProgress ? `
                <div class="tb-progress" style="margin-top:6px;height:6px;border-radius:999px;background:rgba(255,255,255,0.1);overflow:hidden;position:relative;">
                  <div class="tb-progress-bar" style="height:100%;width:${progressPct}%;background:linear-gradient(90deg,#4a9eff,#00d4ff);transition:width 0.5s ease;position:relative;overflow:hidden;">
                    <div class="tb-progress-shine" style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent);animation:shine 1.5s infinite;"></div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
      listEl.innerHTML = html;
    }

    function setOpen(open){
      state.open = !!open;
      panel.classList.toggle('open', state.open);
      panel.setAttribute('aria-hidden', state.open ? 'false' : 'true');
      toggleBtn.setAttribute('aria-pressed', state.open ? 'true' : 'false');
      saveOpen();
    }

    toggleBtn.addEventListener('click', () => setOpen(!state.open));
    hideEl?.addEventListener('click', () => setOpen(false));
    sendEl?.addEventListener('click', () => { const v = inputEl?.value; if (inputEl) inputEl.value=''; submitRemoteTask(v); });
    
    inputEl?.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        const v = inputEl.value; inputEl.value = '';
        submitRemoteTask(v);
      }
    });
    inputEl?.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value === '/') {
        // スラッシュのみの場合、円形ダイヤルを表示
        showMCPDial();
        e.target.value = ''; // スラッシュを消す
      }
    });
    // クリック外でダイヤルを非表示
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && dialOverlay && !dialOverlay.contains(e.target)) {
        dialOverlay.classList.remove('active');
      }
    });
    listEl?.addEventListener('click', async (e) => {
      const any = e.target.closest('.task-item');
      if (!any) return; const id = any.getAttribute('data-id');
      if (!id) return;
      const actionEl = e.target.closest('[data-action="open-url"],[data-action="open-file"],[data-action="open-folder"]');
      try {
        if (actionEl) {
          const action = actionEl.getAttribute('data-action');
          if (action === 'open-url') {
            const encodedUrl = actionEl.getAttribute('data-url');
            const url = encodedUrl ? decodeURIComponent(encodedUrl) : null;
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            return;
          }
          if (action === 'open-file') {
            const encodedPath = actionEl.getAttribute('data-path');
            const filePath = encodedPath ? decodeURIComponent(encodedPath) : null;
            if (filePath) {
              // 直接ファイルパスを開く（絶対パスの場合）
              if (filePath.startsWith('/')) {
                try {
                  const base = await probeBackendBase();
                  const res = await fetch(`${base.replace(/\/$/, '')}/api/open-file-absolute`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ path: filePath }) 
                  });
                  if (!res.ok) {
                    console.error('Failed to open file:', await res.text());
                  }
                } catch(err) {
                  console.error('Failed to open file:', err);
                  // フォールバック: ブラウザで開く
                  window.open(`file://${filePath}`, '_blank');
                }
              } else {
                // 相対パスの場合は従来通り
                const base = await probeBackendBase();
                fetch(`${base.replace(/\/$/, '')}/api/open-file`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath }) }).catch(() => {});
              }
            }
            return;
          }
          if (action === 'open-folder') {
            const encodedPath = actionEl.getAttribute('data-path');
            const folderPath = encodedPath ? decodeURIComponent(encodedPath) : null;
            if (folderPath) {
              // フォルダを開く（絶対パスの場合）
              if (folderPath.startsWith('/')) {
                try {
                  const base = await probeBackendBase();
                  const res = await fetch(`${base.replace(/\/$/, '')}/api/open-folder-absolute`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ path: folderPath }) 
                  });
                  if (!res.ok) {
                    console.error('Failed to open folder:', await res.text());
                  }
                } catch(err) {
                  console.error('Failed to open folder:', err);
                }
              } else {
                // 相対パスの場合
                const base = await probeBackendBase();
                fetch(`${base.replace(/\/$/, '')}/api/open-folder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: folderPath }) }).catch(() => {});
              }
            }
            return;
          }
        }
        const task = state.tasks.find(t => String(t.id) === String(id));
        if (!task) throw new Error('task not found');
        
        // AIチャット履歴を含む完全な情報
        const fullData = {
          id: task.id,
          status: task.status,
          prompt: task.prompt,
          response: task.response,
          result: task.result,
          error: task.error,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          // 詳細な実行結果情報
          executionDetails: task.result ? {
            turns: task.result.num_turns || task.result.numTurns,
            duration_ms: task.result.duration_ms || task.result.durationMs,
            cost_usd: task.result.total_cost_usd,
            usage: task.result.usage,
            session_id: task.result.session_id,
            is_error: task.result.is_error
          } : null,
          // AIからの最終的な回答
          aiResult: task.result && task.result.result ? task.result.result : null
        };
        
        openJsonModal(JSON.stringify(fullData, null, 2), `Task #${id} - 詳細`);
      } catch(err) {
        openJsonModal(JSON.stringify({ error: '結果の取得に失敗しました', id, detail: String(err && err.message || err) }, null, 2), 'Result Error');
      }
    });

    // 初期描画と監視開始
    render();
    setOpen(!!state.open);
    loadMCPTools(); // MCPツールを読み込む
    
    // デバッグ：ツールが読み込まれたか確認
    setTimeout(() => {
      console.log('MCP tools state:', state.mcpTools);
    }, 100);
    
    setInterval(() => {
      if (state.tasks.some(t => t.status === 'running')) render();
    }, 500);
  } catch(err) {
    console.error('TaskBoard init failed', err);
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  initUIFlow();
  renderPackages();
  renderServers();
  initClientSamples();
  initImageModals();
  initContextMenu();
  initDocMenuTable();
  initTaskBoard();
});
