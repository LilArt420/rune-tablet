// The Rune Tablet window: kRO's Rune Tablet / Rune Book / Decomposition, drawn
// from the client's own runesystem art (data/texture/유저인터페이스/runesystem/).
// DATA (above) is the client's Rune tables; the server's Rune Tablet keeps each
// character's runes and sets, and npc/rune_tablet_ui.txt answers @runetab.

const W = 660, H = 522, LEFT = 283;
const TABS = ['tablet', 'book', 'decomp'];

const STYLE = `
.rt { font: 12px Tahoma, Verdana, sans-serif; color: #1d2b4f; }
.rt { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; user-select: none; }
.rt img.bg, .rt .abs { position: absolute; }
.rt .tabs { position: absolute; left: 9px; top: 4px; width: 265px; height: 26px; cursor: pointer; }
.rt .tagbar { position: absolute; left: 0; top: 32px; width: ${LEFT}px; height: 32px; }
.rt .tagbar .label { position: absolute; left: 30px; right: 30px; top: 8px; text-align: center; font-weight: bold; }
.rt .arrow { position: absolute; top: 9px; width: 10px; height: 15px; cursor: pointer; }
.rt .list { position: absolute; left: 3px; top: 68px; width: 280px; height: 418px; overflow-y: auto; overflow-x: hidden; }
.rt .row { position: relative; width: 276px; margin-bottom: 1px; cursor: pointer; }
.rt .row img.rbg { position: absolute; left: 0; top: 0; }
.rt .row .icon { position: absolute; left: 6px; width: 35px; height: 35px; }
.rt .row .name { position: absolute; left: 48px; right: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rt .row .sub { position: absolute; left: 48px; right: 8px; color: #56658a; font-size: 11px; }
.rt .right { position: absolute; left: ${LEFT}px; top: 0; width: 377px; height: ${H}px; }
.rt .title { position: absolute; left: 48px; right: 48px; top: 15px; height: 24px; text-align: center; font-weight: bold; font-size: 13px; line-height: 24px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rt .pane { position: absolute; left: 14px; right: 14px; top: 56px; bottom: 46px; overflow-y: auto; }
.rt .center { text-align: center; }
.rt .mats { display: flex; flex-wrap: wrap; gap: 6px 10px; justify-content: center; margin: 8px 0; }
.rt .mat { width: 52px; text-align: center; font-size: 11px; }
.rt .mat .slot { position: relative; width: 38px; height: 38px; margin: 0 auto 2px; }
.rt .mat .slot img { position: absolute; left: 0; top: 0; }
.rt .mat .slot img.item { left: 7px; top: 7px; width: 24px; height: 24px; }
.rt .short { color: #c0392b; } .enough { color: #1e8449; }
.rt .slots6 { display: grid; grid-template-columns: repeat(3, 40px); gap: 6px; justify-content: center; margin: 6px 0; }
.rt .slots6 img { width: 35px; height: 35px; }
.rt .slots6 .off { filter: grayscale(1) opacity(.35); }
.rt .desc { margin: 6px 2px; line-height: 1.45; }
.rt .desc b { color: #2b4f9e; }
.rt .btn { position: absolute; bottom: 14px; cursor: pointer; }
.rt .btn.disabled { cursor: default; }
.rt .msg { position: absolute; left: 14px; right: 14px; bottom: 40px; text-align: center; font-weight: bold; min-height: 16px; }
.rt .empty { color: #56658a; padding: 14px; text-align: center; }
`;

const escape = text => String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const percent = n => (n / 1000).toFixed(n % 1000 ? 1 : 0) + '%';

export default function init(parameters, api) {
    if (api?.version !== 1) throw new Error('rune-tablet requires client API 1');
    const art = new Map();
    const image = name => {
        if (!art.has(name)) art.set(name, api.screens.image('runesystem/' + name).catch(() => null));
        return art.get(name);
    };
    const setSrc = async (img, name) => { const url = await image(name); if (url) img.src = url; else img.style.visibility = 'hidden'; };
    const itemName = id => api.items.get(id)?.name || `Item ${id}`;

    // the frame adds a 1px border and a 22px title bar around the body
    const win = api.ui.window({ id: 'runetablet', title: 'Rune Tablet', width: W + 2, height: H + 25, resizable: false });
    win.body.innerHTML = `<style>${STYLE}</style><div class="rt">
        <img class="bg" style="left:0;top:0" data-art="bg_rune_list.bmp">
        <img class="tabs" data-tabs>
        <div class="tagbar"><img class="bg" data-art="bg_tag1.bmp"><img class="arrow" style="left:10px" data-arrow="-1">
            <div class="label"></div><img class="arrow" style="right:10px" data-arrow="1"></div>
        <div class="list"></div>
        <div class="right"><img class="bg" style="left:0;top:0" data-art="bg_runeset_center.bmp">
            <div class="title"></div><div class="pane"></div><div class="msg"></div>
            <img class="btn" data-btn></div></div>`;
    const $ = sel => win.body.querySelector(sel);
    for (const img of win.body.querySelectorAll('img[data-art]')) setSrc(img, img.dataset.art);
    const arrows = [...win.body.querySelectorAll('[data-arrow]')];
    for (const a of arrows) setSrc(a, a.dataset.arrow === '-1' ? 'bt_tag_left_nomal.bmp' : 'bt_tag_right_nomal.bmp');

    let tab = 'book', tagIndex = 0, selected = null, state = { runes: new Set(), sets: new Map() };
    const tagsWith = list => [...new Set(list.map(e => e.tag))].sort((a, b) => a - b);

    async function request(text) {
        return api.server.request('runetab', text, { timeout: 8000 });
    }
    async function loadState() {
        const reply = await request('state');
        const [r = '', s = ''] = reply.split(';');
        state.runes = new Set(r.replace(/^r:/, '').split(',').filter(Boolean).map(Number));
        state.sets = new Map(s.replace(/^s:/, '').split(',').filter(Boolean).map(p => {
            const [id, lv] = p.split('='); const [level, fail] = lv.split('/').map(Number); return [Number(id), { level, fail }];
        }));
    }
    async function counts(ids) {
        const out = new Map();
        if (!ids.length) return out;
        const reply = await request('count ' + [...new Set(ids)].join(','));
        for (const p of reply.split(',').filter(Boolean)) { const [id, n] = p.split('=').map(Number); out.set(id, n); }
        return out;
    }

    function button(name, enabled, onClick, left) {
        const img = $('[data-btn]');
        img.style.left = (left ?? Math.round((377 - (name === 'active' || name === 'equip' ? 154 : 114)) / 2)) + 'px';
        img.style.display = name ? '' : 'none';
        if (!name) return;
        img.className = 'btn' + (enabled ? '' : ' disabled');
        const set = s => setSrc(img, `bt_${name}_${s}.bmp`);
        set(enabled ? 'nomal' : 'disabled');
        img.onmouseenter = () => enabled && set('mouseon');
        img.onmouseleave = () => enabled && set('nomal');
        img.onmousedown = () => enabled && set('pressed');
        img.onclick = () => enabled && onClick();
    }
    const message = (text, ok) => { const m = $('.msg'); m.textContent = text || ''; m.className = 'msg ' + (ok ? 'enough' : 'short'); };

    function renderTabs() {
        setSrc($('[data-tabs]'), `runesystam_tab_${TABS.indexOf(tab)}.bmp`);
        const tags = tab === 'tablet' ? tagsWith(DATA.sets) : tab === 'book' ? tagsWith(DATA.runes) : [];
        $('.tagbar').style.display = tags.length ? '' : 'none';
        if (tags.length) {
            tagIndex = Math.max(0, Math.min(tagIndex, tags.length - 1));
            $('.tagbar .label').textContent = DATA.tags[tags[tagIndex]] || `Tag ${tags[tagIndex]}`;
        }
        return tags;
    }

    function rowElement(kind, height, on, iconName, name, sub) {
        const row = document.createElement('div');
        row.className = 'row';
        row.style.height = height + 'px';
        const bg = document.createElement('img');
        bg.className = 'rbg';
        setSrc(bg, `list_${kind}_item_${on ? 1 : 0}_${on ? 1 : 0}.bmp`);
        row.append(bg);
        if (iconName) {
            const icon = document.createElement('img');
            icon.className = 'icon';
            icon.style.top = Math.round((height - 35) / 2) + 'px';
            if (iconName.startsWith('item:')) api.items.icon(Number(iconName.slice(5))).then(u => u && (icon.src = u));
            else setSrc(icon, iconName);
            row.append(icon);
        }
        const n = document.createElement('div');
        n.className = 'name';
        n.style.top = (sub ? Math.round(height / 2) - 15 : Math.round(height / 2) - 8) + 'px';
        n.textContent = name;
        row.append(n);
        if (sub) {
            const s = document.createElement('div');
            s.className = 'sub';
            s.style.top = Math.round(height / 2) + 2 + 'px';
            s.textContent = sub;
            row.append(s);
        }
        return row;
    }

    async function renderList() {
        const tags = renderTabs();
        const list = $('.list');
        list.innerHTML = '';
        if (tab === 'decomp') {
            const reply = await request('decomplist').catch(e => '');
            const items = reply.split(',').filter(Boolean).map(p => { const [id, rest] = p.split('='); const [n, many] = rest.split(':'); return { id: Number(id), n: Number(n), many: many === '1' }; });
            if (!items.length) list.innerHTML = '<div class="empty">Nothing you carry can be decomposed.</div>';
            for (const it of items) {
                const row = rowElement('decom', 45, selected?.id === it.id, `item:${it.id}`, itemName(it.id), `You carry ${it.n}`);
                row.onclick = () => { selected = it; renderList(); renderDetail(); };
                list.append(row);
            }
            return;
        }
        const entries = (tab === 'tablet' ? DATA.sets : DATA.runes).filter(e => e.tag === tags[tagIndex]);
        for (const e of entries) {
            let row;
            if (tab === 'book') {
                row = rowElement('rune', 47, selected?.id === e.id, `rune_icon/${e.res}.bmp`, e.name, state.runes.has(e.id) ? 'Registered' : 'Not registered');
            } else {
                const have = e.slots.filter(r => r && state.runes.has(r)).length, total = e.slots.filter(Boolean).length;
                const lv = state.sets.get(e.id)?.level || 0;
                row = rowElement('runeset', 68, selected?.id === e.id, null, e.name, `${have}/${total} runes${lv ? `  ·  +${lv}` : ''}`);
            }
            row.onclick = () => { selected = e; message(''); renderList(); renderDetail(); };
            list.append(row);
        }
    }

    function matsHtml(mats, have) {
        return `<div class="mats">${mats.map(([id, need]) => {
            const n = have.get(id) ?? 0;
            return `<div class="mat" title="${escape(itemName(id))}"><div class="slot"><img data-art="iconslot_${n >= need ? 'blue' : 'red'}.bmp"><img class="item" data-item="${id}"></div>
                <span class="${n >= need ? 'enough' : 'short'}">${n}/${need}</span></div>`;
        }).join('')}</div>`;
    }
    function fillImages(root) {
        for (const img of root.querySelectorAll('img[data-art]')) setSrc(img, img.dataset.art);
        for (const img of root.querySelectorAll('img[data-item]')) api.items.icon(Number(img.dataset.item)).then(u => u && (img.src = u));
    }

    async function renderDetail() {
        const pane = $('.pane');
        $('.title').textContent = '';
        pane.innerHTML = '';
        button(null);
        if (!selected) {
            pane.innerHTML = `<div class="empty">${tab === 'decomp' ? 'Pick an item to break down.' : 'Pick an entry from the list.'}</div>`;
            return;
        }
        if (tab === 'book') {
            const e = selected, done = state.runes.has(e.id);
            $('.title').textContent = e.name;
            const have = done ? new Map() : await counts(e.mats.map(m => m[0]));
            pane.innerHTML = `<div class="center"><div style="position:relative;width:188px;height:249px;margin:0 auto">
                <img data-art="rune_edge_big.bmp" style="position:absolute;left:0;top:0"><img data-art="rune/${e.res}.bmp" style="position:absolute;left:4px;top:4px;${done ? '' : 'filter:grayscale(.85) opacity(.6)'}"></div></div>
                ${done ? '<div class="center enough" style="margin-top:10px">Registered</div>' : matsHtml(e.mats, have)}`;
            fillImages(pane);
            const ready = !done && e.mats.every(([id, need]) => (have.get(id) ?? 0) >= need);
            button('active', ready, async () => {
                const reply = await request('register ' + e.id).catch(err => 'err|' + err.message);
                const [status, text] = reply.split('|');
                message(text, status === 'ok');
                if (status === 'ok') { await loadState(); renderList(); renderDetail(); }
            });
        } else if (tab === 'tablet') {
            const e = selected, st = state.sets.get(e.id) || { level: 0, fail: 0 };
            const have = e.slots.filter(r => r && state.runes.has(r)).length;
            $('.title').textContent = `${e.name}${st.level ? `  +${st.level}` : ''}`;
            const next = st.level < 15 ? e.ups[st.level] || [] : [];
            const owned = next.length ? await counts(next.map(m => m[0])) : new Map();
            const chance = Math.min(100000, (e.rate[st.level] || 0) + (st.fail || 0));
            const runeRes = id => DATA.runes.find(r => r.id === id)?.res;
            pane.innerHTML = `<div class="center"><img data-art="runeset/${e.res}.bmp"></div>
                <div class="slots6">${e.slots.map(r => r ? `<img data-art="rune_icon/${runeRes(r)}.bmp" class="${state.runes.has(r) ? '' : 'off'}" title="${escape(DATA.runes.find(x => x.id === r)?.name)}">` : '<span></span>').join('')}</div>
                <div class="desc">${e.desc.map(([n, lines]) => `<div style="${have >= n ? '' : 'opacity:.55'}"><b>${n} runes:</b> ${escape(lines.filter(l => !/^_+$/.test(l)).join(' '))}</div>`).join('')}</div>
                ${st.level >= 15 ? '<div class="center enough">Upgraded to +15.</div>' :
                    `<div class="center">Upgrade to +${st.level + 1}: <b>${percent(chance)}</b>${st.fail ? ` <small>(+${percent(st.fail)} from failures)</small>` : ''}</div>${matsHtml(next, owned)}`}`;
            fillImages(pane);
            const ready = have > 0 && st.level < 15 && next.every(([id, need]) => (owned.get(id) ?? 0) >= need);
            button('upgrade', ready, async () => {
                const reply = await request('upgrade ' + e.id).catch(err => 'err|' + err.message);
                const [status, what, value] = reply.split('|');
                if (status !== 'ok') message(what, false);
                else message(what === 'success' ? `Success! It is now +${value}.` : 'It failed. The next attempt is a little more likely.', what === 'success');
                await loadState(); renderList(); renderDetail();
            });
        } else {
            const it = selected;
            $('.title').textContent = itemName(it.id);
            pane.innerHTML = `<div class="center"><div style="position:relative;width:166px;height:124px;margin:10px auto">
                <img data-art="decom_empty.bmp" style="position:absolute;left:0;top:0"><img data-item="${it.id}" style="position:absolute;left:71px;top:50px;width:24px;height:24px"></div>
                <div>You carry ${it.n}.</div><div class="result" style="margin-top:10px"></div></div>`;
            fillImages(pane);
            const run = async qty => {
                const reply = await request(`decompose ${it.id} ${qty}`).catch(err => 'err|' + err.message);
                const [status, rest] = reply.split('|');
                if (status !== 'ok') { message(rest, false); return; }
                const got = (rest || '').split(',').filter(Boolean).map(p => p.split(':').map(Number));
                message(got.length ? 'Decomposed.' : 'Nothing usable came out of it.', got.length > 0);
                pane.querySelector('.result').innerHTML = got.map(([id, q]) => `${escape(itemName(id))} x${q}`).join('<br>');
                it.n -= qty > 1 ? 30 : 1;
                if (it.n <= 0) selected = null;
                renderList();
            };
            button('decom', it.n >= 1, () => run(1), 60);
            const second = $('[data-btn]').cloneNode();
            second.removeAttribute('data-btn');
            second.dataset.btn2 = '';
            $('.right').querySelector('[data-btn2]')?.remove();
            $('.right').append(second);
            const many = it.many && it.n >= 30;
            second.style.left = '203px';
            second.className = 'btn' + (many ? '' : ' disabled');
            const set = s => setSrc(second, `bt_decom2_${s}.bmp`);
            set(many ? 'nomal' : 'disabled');
            second.onmouseenter = () => many && set('mouseon');
            second.onmouseleave = () => many && set('nomal');
            second.onclick = () => many && run(30);
            second.title = 'Decompose 30 at once';
        }
    }

    $('[data-tabs]').onclick = event => {
        // the strip's three tabs: 0-64, 67-131 and 134-198 px; the rest is blank
        const x = event.offsetX;
        if (x > 198) return;
        const index = x < 66 ? 0 : x < 133 ? 1 : 2;
        tab = TABS[index];
        selected = null;
        message('');
        $('.right').querySelector('[data-btn2]')?.remove();
        renderList();
        renderDetail();
    };
    for (const a of arrows) a.onclick = () => { tagIndex += Number(a.dataset.arrow); selected = null; renderList(); renderDetail(); };

    async function open() {
        try { await loadState(); } catch (error) { message(String(error.message || error), false); }
        win.show();
        renderList();
        renderDetail();
    }
    // leaving the game (to character select or the login) closes it
    api.on('exit', () => win.hide());
    api.on('server:event', ({ command, text }) => {
        if (command === 'runetab' && String(text).trim() === 'open') open();
    });
}
