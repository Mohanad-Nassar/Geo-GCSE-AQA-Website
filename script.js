// ── TAB SWITCHING ──
function switchTab(id, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    btn.classList.add('active');
    if (id === 'learn' || id === 'examtips') showDoubleClickHint();
    // Hide all floating progress bars; the IntersectionObserver on the new
    // tab will re-show the right one if the user has scrolled past it
    document.querySelectorAll('.prog-float').forEach(f => f.classList.remove('visible'));
}

// ── HEADER ACTIONS (Expand All + Grid/List toggle) ──
function injectExpandAll(tabId, gridId, cardClass) {
    const tabPanel = document.getElementById(tabId);
    const grid = document.getElementById(gridId);
    if (!tabPanel || !grid) return;
    if (tabPanel.querySelector('.header-actions-wrap')) return;

    const title = tabPanel.querySelector('.section-title');
    const subTitle = tabPanel.querySelector('.section-sub');

    const headerWrap = document.createElement('div');
    headerWrap.className = 'header-actions-wrap';

    const textWrap = document.createElement('div');
    if (title) textWrap.appendChild(title);
    if (subTitle) { subTitle.style.marginBottom = '0'; textWrap.appendChild(subTitle); }

    const actionWrap = document.createElement('div');
    actionWrap.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px;';

    let isListView = true, isExpanded = true;
    grid.classList.add('list-view');
    grid.querySelectorAll('.' + cardClass).forEach(c => c.classList.add('open'));

    const layoutBtn = document.createElement('button');
    layoutBtn.className = 'fc-btn outline';
    layoutBtn.innerHTML = '🔠 Grid View';
    layoutBtn.addEventListener('click', () => {
        isListView = !isListView;
        layoutBtn.innerHTML = isListView ? '🔠 Grid View' : '🔲 List View';
        grid.classList.toggle('list-view', isListView);
    });

    const expandBtn = document.createElement('button');
    expandBtn.className = 'fc-btn outline';
    expandBtn.innerHTML = '📂 Collapse All Cards';
    expandBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        expandBtn.innerHTML = isExpanded ? '📂 Collapse All Cards' : '📂 Expand All Cards';
        grid.querySelectorAll('.' + cardClass).forEach(c => c.classList.toggle('open', isExpanded));
        window.getSelection().removeAllRanges();
    });

    actionWrap.appendChild(layoutBtn);
    actionWrap.appendChild(expandBtn);
    headerWrap.appendChild(textWrap);
    headerWrap.appendChild(actionWrap);
    tabPanel.insertBefore(headerWrap, grid);
}

// ── BUILD LEARN ──
function buildLearn() {
    const grid = document.getElementById('topicGrid');
    if (!grid) return;
    topics.forEach(t => {
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.innerHTML = `<span class="tag">${t.tag}</span><h3>${t.title}</h3><span class="toggle-icon">+</span><div class="topic-content">${t.content}</div>`;
        card.addEventListener('dblclick', () => { card.classList.toggle('open'); window.getSelection().removeAllRanges(); });
        grid.appendChild(card);
    });
    injectExpandAll('tab-learn', 'topicGrid', 'topic-card');
}

// ── BUILD MCQ ──
let mcqScore = 0, mcqTotal = 0;

function injectMCQProgressBar() {
    if (document.getElementById('mcqBarWrap')) return;
    const wrap = document.getElementById('mcqWrap');
    if (!wrap) return;
    const bar = createProgressBar('mcq', '❓ Multiple Choice — Progress ');
    wrap.parentElement.insertBefore(bar, wrap);
}

function updateMCQProgress() {
    updateProgressBar('mcq', mcqTotal, mcqData.length);
    if (mcqTotal > 0 && mcqTotal >= mcqData.length) {
        const perfect = mcqScore === mcqData.length;
        setTimeout(() => showCelebration({
            title: perfect ? 'Full Marks!' : 'Quiz Complete!',
            subtitle: perfect
                ? 'Every answer correct — excellent work! 🌟'
                : `You scored ${mcqScore} out of ${mcqData.length}`,
            extra: `${mcqData.length} question${mcqData.length !== 1 ? 's' : ''} answered`,
            onReset: resetMCQ
        }), 400);
    }
}

function buildMCQ() {
    const wrap = document.getElementById('mcqWrap');
    if (!wrap) return;
    mcqData.forEach((q, qi) => {
        const block = document.createElement('div');
        block.className = 'q-block';
        block.innerHTML = `<div class="q-num">QUESTION ${qi + 1}</div><div class="q-text">${q.q}</div>
<div class="options">${q.opts.map((o, oi) => `<button class="opt-btn" data-qi="${qi}" data-oi="${oi}">${o}</button>`).join('')}</div>
<div class="q-feedback" id="qfb-${qi}"></div>`;
        wrap.appendChild(block);
    });
    wrap.addEventListener('click', e => {
        if (!e.target.classList.contains('opt-btn')) return;
        const qi = +e.target.dataset.qi, oi = +e.target.dataset.oi;
        const block = e.target.closest('.q-block');
        if (block.dataset.answered) return;
        block.dataset.answered = 1; mcqTotal++;
        block.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
        const fb = document.getElementById(`qfb-${qi}`);
        if (oi === mcqData[qi].ans) {
            e.target.classList.add('correct');
            fb.textContent = '✓ Correct! ' + mcqData[qi].explain;
            fb.className = 'q-feedback show ok'; mcqScore++;
        } else {
            e.target.classList.add('wrong');
            block.querySelectorAll('.opt-btn')[mcqData[qi].ans].classList.add('correct');
            fb.textContent = '✗ ' + mcqData[qi].explain;
            fb.className = 'q-feedback show no';
        }
        document.getElementById('mcqScore').textContent = mcqScore;
        document.getElementById('mcqTotal').textContent = mcqTotal;
        updateMCQProgress();
    });
    injectMCQProgressBar();
    updateProgressBar('mcq', 0, mcqData.length);
}
function resetMCQ() {
    mcqScore = 0; mcqTotal = 0;
    document.getElementById('mcqScore').textContent = 0;
    document.getElementById('mcqTotal').textContent = 0;
    document.getElementById('mcqWrap').innerHTML = '';
    destroyProgressBar('mcq');
    const old = document.getElementById('mcqBarWrap');
    if (old) old.remove();
    buildMCQ();
}

// ── BUILD MATCHING ──
let matchSelected = null, matchScore = 0, matchTotal = 0;
const matchMistakes = new Set();
let matchLocked = false;
let matchRound = 1;
let matchRoundScores = [0, 0];
let matchRoundSize = 0; // 0 = auto (split in half)

function getMatchRoundSize() {
    // If a custom size is set, use it; otherwise half the deck (rounded up)
    return matchRoundSize > 0 ? matchRoundSize : Math.ceil(matchData.length / 2);
}

function getMatchRoundData(round) {
    const size = getMatchRoundSize();
    return round === 1 ? matchData.slice(0, size) : matchData.slice(size);
}

// ── Find the score bar that contains matchScore — works regardless of tab ID
function getMatchScoreBar() {
    const el = document.getElementById('matchScore');
    return el ? el.closest('.score-bar') : null;
}

// ── Inject the round-size picker into the score bar (beside Randomise / Reset)
function injectMatchSizePicker() {
    if (document.getElementById('matchSizePicker')) return;
    const scoreBar = getMatchScoreBar();
    if (!scoreBar) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const lbl = document.createElement('label');
    lbl.htmlFor = 'matchSizePicker';
    lbl.style.cssText = "font-family:'DM Mono',monospace;font-size:10px;color:var(--mid);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;";
    lbl.textContent = 'Per round:';

    const sel = document.createElement('select');
    sel.id = 'matchSizePicker';
    sel.style.cssText = `
        appearance:none; -webkit-appearance:none;
        background:var(--surface2); border:1.5px solid var(--border);
        border-radius:6px; padding:5px 10px;
        font-family:'DM Mono',monospace; font-size:11px; font-weight:600;
        color:var(--accent2); cursor:pointer; outline:none;
        transition:border-color .15s;
    `;
    sel.addEventListener('focus', () => sel.style.borderColor = 'var(--accent2)');
    sel.addEventListener('blur', () => sel.style.borderColor = 'var(--border)');

    // Build options: Auto, then 4 up to matchData.length-1 (always leave at least 1 in round 2)
    const autoOpt = document.createElement('option');
    autoOpt.value = '0';
    autoOpt.textContent = 'Auto';
    sel.appendChild(autoOpt);

    const max = matchData.length - 1; // at least 1 item must go to round 2
    for (let i = 4; i <= max; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = String(i);
        sel.appendChild(opt);
    }
    sel.value = '0';

    sel.addEventListener('change', () => {
        matchRoundSize = parseInt(sel.value, 10);
        rebuildMatchHeader(); // update bars to reflect new sizes
        resetMatch();
    });

    wrapper.appendChild(lbl);
    wrapper.appendChild(sel);

    // Put it before the first .reset-btn in the score bar
    const resetBtn = scoreBar.querySelector('.reset-btn');
    if (resetBtn) { scoreBar.insertBefore(wrapper, resetBtn); }
    else scoreBar.appendChild(wrapper);
}

// ── Rebuild header (on size change)
function rebuildMatchHeader() {
    const old = document.getElementById('matchRoundHeader');
    if (old) old.remove();
    injectMatchHeader();
}

// ── Inject the round header: overall bar + per-round bars
// Called AFTER buildMatchRound so matchLeft exists in the DOM
function injectMatchHeader() {
    if (document.getElementById('matchRoundHeader')) return;

    const r1count = getMatchRoundData(1).length;
    const r2count = getMatchRoundData(2).length;
    const total = r1count + r2count;

    const header = document.createElement('div');
    header.id = 'matchRoundHeader';
    header.style.cssText = `
        background:var(--surface2);
        border:1px solid var(--border);
        border-radius:10px;
        padding:16px 20px;
        margin-bottom:16px;
        display:flex;
        flex-direction:column;
        gap:14px;
    `;
    header.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent2);letter-spacing:.12em;text-transform:uppercase;">🃏 Matching — 2 Rounds</span>
            <span id="matchRoundLabel" style="font-family:'DM Mono',monospace;font-size:11px;color:var(--mid);letter-spacing:.08em;">Currently on Round 1 of 2</span>
        </div>
        <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--mid);letter-spacing:.06em;text-transform:uppercase;">Overall Progress</span>
                <span id="matchOverallLabel" style="font-family:'DM Mono',monospace;font-size:10px;color:var(--mid);">0 / ${total}</span>
            </div>
            <div style="background:var(--border);border-radius:99px;height:10px;overflow:hidden;">
                <div id="matchBarOverall" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--gold));border-radius:99px;transition:width .4s ease;"></div>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--mid);width:60px;flex-shrink:0;">Round 1</span>
                <div style="flex:1;background:var(--border);border-radius:99px;height:7px;overflow:hidden;">
                    <div id="matchBar1" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:99px;transition:width .4s ease;"></div>
                </div>
                <span id="matchBarLabel1" style="font-family:'DM Mono',monospace;font-size:10px;color:var(--mid);width:40px;text-align:right;">0/${r1count}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--mid);width:60px;flex-shrink:0;">Round 2</span>
                <div style="flex:1;background:var(--border);border-radius:99px;height:7px;overflow:hidden;">
                    <div id="matchBar2" style="height:100%;width:0%;background:linear-gradient(90deg,var(--teal),var(--accent2));border-radius:99px;transition:width .4s ease;opacity:.35;"></div>
                </div>
                <span id="matchBarLabel2" style="font-family:'DM Mono',monospace;font-size:10px;color:var(--mid);width:40px;text-align:right;">0/${r2count}</span>
            </div>
        </div>
    `;

    // Insert directly before the match grid wrapper
    const matchLeft = document.getElementById('matchLeft');
    const matchGrid = matchLeft ? (matchLeft.closest('.match-grid') || matchLeft.parentElement) : null;
    if (matchGrid) {
        matchGrid.parentElement.insertBefore(header, matchGrid);
    } else {
        const scoreBar = getMatchScoreBar();
        if (scoreBar) scoreBar.after(header);
    }
}

// ── Update per-round bar + overall bar
function updateMatchProgress(round) {
    const r1data = getMatchRoundData(1);
    const r2data = getMatchRoundData(2);
    const data = round === 1 ? r1data : r2data;
    const total = data.length;
    const left = document.getElementById('matchLeft');
    if (!left) return;

    const done = round === matchRound
        ? left.querySelectorAll('.matched-ok, .matched-eventual').length
        : (round < matchRound ? total : 0);
    const pct = total ? (done / total) * 100 : 0;

    const bar = document.getElementById(`matchBar${round}`);
    const lbl = document.getElementById(`matchBarLabel${round}`);
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = `${done}/${total}`;

    // Overall bar
    const r1done = matchRound > 1 ? r1data.length : (round === 1 ? done : 0);
    const r2done = matchRound > 1 && round === 2 ? done : 0;
    const grandTotal = r1data.length + r2data.length;
    const grandDone = r1done + r2done;
    const overallPct = grandTotal ? (grandDone / grandTotal) * 100 : 0;
    const overallBar = document.getElementById('matchBarOverall');
    const overallLbl = document.getElementById('matchOverallLabel');
    if (overallBar) overallBar.style.width = overallPct + '%';
    if (overallLbl) overallLbl.textContent = `${grandDone} / ${grandTotal}`;
}

// ── Celebration overlay
function showMatchCelebration() {
    if (!document.getElementById('matchCelebStyles')) {
        const s = document.createElement('style');
        s.id = 'matchCelebStyles';
        s.textContent = `
            @keyframes celebBounceIn {
                0%   { opacity:0; transform:translate(-50%,-50%) scale(.5) rotate(-4deg); }
                60%  { opacity:1; transform:translate(-50%,-50%) scale(1.08) rotate(2deg); }
                80%  { transform:translate(-50%,-50%) scale(.97) rotate(-1deg); }
                100% { transform:translate(-50%,-50%) scale(1) rotate(0deg); }
            }
            @keyframes celebBounceOut {
                0%   { opacity:1; transform:translate(-50%,-50%) scale(1); }
                100% { opacity:0; transform:translate(-50%,-50%) scale(.8); }
            }
            @keyframes celebFloat {
                0%,100% { transform:translateY(0); }
                50%     { transform:translateY(-8px); }
            }
            @keyframes confettiFall {
                0%   { transform:translateY(-20px) rotate(0deg); opacity:1; }
                100% { transform:translateY(100vh) rotate(720deg); opacity:0; }
            }
        `;
        document.head.appendChild(s);
    }

    const colours = ['#52b788', '#e9c46a', '#0077b6', '#e76f51', '#d8ede5'];
    for (let i = 0; i < 65; i++) {
        const piece = document.createElement('div');
        piece.style.cssText = `
            position:fixed; top:0;
            left:${Math.random() * 100}vw;
            width:${6 + Math.random() * 8}px; height:${6 + Math.random() * 8}px;
            background:${colours[Math.floor(Math.random() * colours.length)]};
            border-radius:${Math.random() > .5 ? '50%' : '2px'};
            z-index:10001; pointer-events:none;
            animation:confettiFall ${1.5 + Math.random() * 2}s ${Math.random() * .8}s ease-in forwards;
        `;
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 4000);
    }

    const overlay = document.createElement('div');
    overlay.id = 'matchCelebOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;backdrop-filter:blur(3px);';

    const card = document.createElement('div');
    card.style.cssText = `
        position:fixed; top:50%; left:50%;
        transform:translate(-50%,-50%);
        background:var(--surface2); border:2px solid var(--accent2);
        border-radius:16px; padding:36px 40px; text-align:center;
        z-index:10002; min-width:280px; max-width:90vw;
        box-shadow:0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(82,183,136,.2);
        animation:celebBounceIn .55s cubic-bezier(.34,1.56,.64,1) forwards;
    `;

    const perfect = matchMistakes.size === 0;
    const r1 = getMatchRoundData(1).length;
    const r2 = getMatchRoundData(2).length;
    card.innerHTML = `
        <div style="font-size:52px;margin-bottom:12px;animation:celebFloat 1.8s ease-in-out infinite;">🎉</div>
        <div style="font-family:'Merriweather',serif;font-size:22px;font-weight:700;color:var(--accent2);margin-bottom:8px;">
            ${perfect ? 'Perfect Score!' : 'All Matched!'}
        </div>
        <div style="font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text-dim);margin-bottom:6px;line-height:1.6;">
            ${perfect
            ? 'You matched every pair first time — amazing work! 🌟'
            : `You got there! ${matchMistakes.size} pair${matchMistakes.size > 1 ? 's' : ''} needed a second try.`}
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--mid);margin-bottom:22px;">
            ${r1} pairs · Round 1 &nbsp;+&nbsp; ${r2} pairs · Round 2
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button id="celebDismiss" style="background:var(--accent);color:var(--text);border:none;border-radius:8px;padding:10px 22px;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.06em;">✓ Done</button>
            <button id="celebReset" style="background:transparent;color:var(--text-dim);border:1.5px solid var(--border);border-radius:8px;padding:10px 22px;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.06em;">🔄 Play Again</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(card);

    const dismiss = () => {
        card.style.animation = 'celebBounceOut .3s ease forwards';
        overlay.style.transition = 'opacity .3s'; overlay.style.opacity = '0';
        setTimeout(() => { card.remove(); overlay.remove(); }, 320);
    };
    document.getElementById('celebDismiss').addEventListener('click', dismiss);
    document.getElementById('celebReset').addEventListener('click', () => { dismiss(); setTimeout(resetMatch, 340); });
    overlay.addEventListener('click', dismiss);
}

function buildMatchRound(round) {
    const left = document.getElementById('matchLeft');
    const right = document.getElementById('matchRight');
    if (!left || !right) return;

    matchSelected = null; matchLocked = false;
    left.innerHTML = ''; right.innerHTML = '';

    const old = document.getElementById('matchNextRoundBtn');
    if (old) old.remove();

    const data = getMatchRoundData(round);
    const shuffled = [...data].sort(() => Math.random() - .5);

    const label = document.getElementById('matchRoundLabel');
    if (label) label.textContent = `Currently on Round ${round} of 2`;

    if (round === 2) {
        const bar2 = document.getElementById('matchBar2');
        if (bar2) bar2.style.opacity = '1';
    }

    updateMatchProgress(1);
    updateMatchProgress(2);

    matchTotal = matchData.length;
    document.getElementById('matchTotal').textContent = matchTotal;

    data.forEach(m => {
        const el = document.createElement('div');
        el.className = 'match-item'; el.textContent = m.term;
        el.dataset.key = m.term; el.dataset.side = 'left';
        left.appendChild(el);
    });
    shuffled.forEach(m => {
        const el = document.createElement('div');
        el.className = 'match-item'; el.textContent = m.def;
        el.dataset.key = m.term; el.dataset.side = 'right';
        right.appendChild(el);
    });

    left.addEventListener('click', handleMatch);
    right.addEventListener('click', handleMatch);
}

function buildMatch() {
    matchScore = 0; matchRound = 1; matchRoundScores = [0, 0];
    document.getElementById('matchScore').textContent = 0;
    buildMatchRound(1);      // build grid FIRST so matchLeft exists in DOM
    injectMatchSizePicker(); // then inject picker into score bar
    injectMatchHeader();     // then inject header above the grid
}

function handleMatch(e) {
    if (matchLocked) return;
    const item = e.target.closest('.match-item');
    if (!item || item.classList.contains('matched-ok') || item.classList.contains('matched-eventual')) return;
    if (!matchSelected) {
        document.querySelectorAll('.match-item.selected').forEach(x => x.classList.remove('selected'));
        item.classList.add('selected'); matchSelected = item;
    } else {
        if (matchSelected === item) { item.classList.remove('selected'); matchSelected = null; return; }
        if (matchSelected.dataset.side === item.dataset.side) {
            matchSelected.classList.remove('selected'); matchSelected = item; item.classList.add('selected'); return;
        }
        const a = matchSelected, b = item;
        a.classList.remove('selected'); b.classList.remove('selected'); matchSelected = null;
        if (a.dataset.key === b.dataset.key) {
            const cls = matchMistakes.has(a.dataset.key) ? 'matched-eventual' : 'matched-ok';
            a.classList.add(cls); b.classList.add(cls);
            matchScore++; matchRoundScores[matchRound - 1]++;
            document.getElementById('matchScore').textContent = matchScore;
            updateMatchProgress(matchRound);
            const left = document.getElementById('matchLeft');
            const total = left.querySelectorAll('.match-item').length;
            const done = left.querySelectorAll('.matched-ok, .matched-eventual').length;
            if (done === total) onRoundComplete();
        } else {
            matchLocked = true;
            matchMistakes.add(a.dataset.key); matchMistakes.add(b.dataset.key);
            a.classList.add('matched-no'); b.classList.add('matched-no');
            setTimeout(() => { a.classList.remove('matched-no'); b.classList.remove('matched-no'); matchLocked = false; }, 700);
        }
    }
}

function onRoundComplete() {
    if (matchRound === 1) {
        updateMatchProgress(1);
        const left = document.getElementById('matchLeft');
        const grid = left.closest('.match-grid') || left.parentElement;
        const btn = document.createElement('button');
        btn.id = 'matchNextRoundBtn';
        btn.className = 'fc-btn';
        btn.style.cssText = 'margin-top:16px;width:100%;font-size:14px;padding:14px;';
        btn.innerHTML = '✅ Round 1 complete — Start Round 2 →';
        btn.addEventListener('click', () => {
            matchRound = 2;
            matchMistakes.clear();
            buildMatchRound(2);
        });
        grid.parentElement.insertBefore(btn, grid.nextSibling);
    } else {
        updateMatchProgress(2);
        setTimeout(showMatchCelebration, 400);
    }
}

function resetMatch() {
    matchScore = 0; matchSelected = null; matchLocked = false;
    matchRound = 1; matchRoundScores = [0, 0];
    matchMistakes.clear();
    document.getElementById('matchScore').textContent = 0;
    document.getElementById('matchLeft').innerHTML = '';
    document.getElementById('matchRight').innerHTML = '';
    const old = document.getElementById('matchNextRoundBtn');
    if (old) old.remove();
    buildMatchRound(1);
    rebuildMatchHeader();
}

function buildFIB() {
    const wrap = document.getElementById('fibWrap');
    if (!wrap) return;
    fibCorrectTotal = fibData.reduce((a, f) => a + Object.keys(f.blanks).filter(k => f.blanks[k] !== '').length, 0);
    document.getElementById('fibTotal').textContent = fibCorrectTotal;
    fibData.forEach((f, fi) => {
        const div = document.createElement('div');
        div.className = 'fib-sentence';
        let html = f.display, bi = 0;
        if (!isAdvancedFIB) {
            const correctAnswers = Object.values(f.blanks).filter(v => v !== '');
            const distractors = fibWords.filter(w => !correctAnswers.includes(w)).sort(() => Math.random() - .5).slice(0, 4);
            html = html.replace(/_____/g, () => {
                const key = Object.keys(f.blanks)[bi];
                const ans = f.blanks[key]; bi++;
                if (!ans) return `<em>(see above)</em>`;
                const opts = [ans, ...distractors.filter(d => d !== ans).slice(0, 3)].sort(() => Math.random() - .5);
                const optHTML = ['— choose —', ...opts].map(o => `<option value="${o === '— choose —' ? '' : o}">${o}</option>`).join('');
                return `<span class="blank-select" data-fi="${fi}" data-key="${key}" data-ans="${ans}"><select>${optHTML}</select></span>`;
            });
            div.innerHTML = html;
        } else {
            html = html.replace(/_____/g, () => {
                const key = Object.keys(f.blanks)[bi];
                const ans = f.blanks[key]; bi++;
                if (!ans) return `<em>(see above)</em>`;
                return `<input type="text" class="fib-input" data-fi="${fi}" data-key="${key}" data-ans="${ans}" placeholder="type here...">`;
            });
            div.innerHTML = html;
            const checkBtn = document.createElement('button');
            checkBtn.className = 'fib-check-btn'; checkBtn.innerHTML = '✓ Check Answers';
            checkBtn.addEventListener('click', () => {
                const inputs = div.querySelectorAll('.fib-input');
                let allOk = true;
                inputs.forEach(input => {
                    if (input.disabled) return;
                    if (isAnswerAcceptable(input.value, input.dataset.ans)) {
                        input.classList.remove('wrong'); input.classList.add('correct');
                        input.disabled = true; fibScore++;
                    } else { input.classList.remove('correct'); input.classList.add('wrong'); allOk = false; }
                });
                document.getElementById('fibScore').textContent = fibScore;
                if (allOk) { checkBtn.innerHTML = 'Perfect! ✨'; checkBtn.disabled = true; }
            });
            div.appendChild(document.createElement('br'));
            div.appendChild(checkBtn);
        }
        wrap.appendChild(div);
    });
    if (!isAdvancedFIB && !wrap.dataset.listenerAttached) {
        wrap.addEventListener('change', e => {
            const sel = e.target; if (sel.tagName !== 'SELECT') return;
            const wrapper = sel.closest('.blank-select'); if (!wrapper || wrapper.dataset.answered === 'correct') return;
            const chosen = sel.value, ans = wrapper.dataset.ans; if (!chosen) return;
            if (chosen === ans) {
                wrapper.dataset.answered = 'correct'; wrapper.classList.remove('wrong'); wrapper.classList.add('correct');
                sel.disabled = true; fibScore++; document.getElementById('fibScore').textContent = fibScore;
            } else {
                wrapper.classList.remove('correct'); wrapper.classList.add('wrong');
                setTimeout(() => { wrapper.classList.remove('wrong'); sel.value = ''; }, 700);
            }
        });
        wrap.dataset.listenerAttached = 'true';
    }
}
function resetFIB() {
    fibScore = 0;
    document.getElementById('fibScore').textContent = 0;
    document.getElementById('fibWrap').innerHTML = '';
    buildFIB();
}
function injectFIBAdvancedToggle() {
    const fibTab = document.getElementById('tab-fib');
    if (!fibTab || fibTab.querySelector('.fib-mode-toggle')) return;
    const scoreBar = fibTab.querySelector('.score-bar');
    if (!scoreBar) return;
    const btn = document.createElement('button');
    btn.className = 'fc-btn outline fib-mode-toggle';
    btn.innerHTML = '🔥 Advanced Mode: Typing';
    btn.style.marginBottom = '20px';
    btn.addEventListener('click', () => {
        isAdvancedFIB = !isAdvancedFIB;
        btn.innerHTML = isAdvancedFIB ? '🔽 Standard Mode: Dropdowns' : '🔥 Advanced Mode: Typing';
        resetFIB();
    });
    fibTab.insertBefore(btn, scoreBar);
}

// ══════════════════════════════════════
// SHARED CELEBRATION (used by FIB, FC, TF, EP)
// ══════════════════════════════════════
function injectCelebStyles() {
    if (document.getElementById('sharedCelebStyles')) return;
    const s = document.createElement('style');
    s.id = 'sharedCelebStyles';
    s.textContent = `
        @keyframes celebBounceIn  { 0%{opacity:0;transform:translate(-50%,-50%) scale(.5) rotate(-4deg)} 60%{opacity:1;transform:translate(-50%,-50%) scale(1.08) rotate(2deg)} 80%{transform:translate(-50%,-50%) scale(.97) rotate(-1deg)} 100%{transform:translate(-50%,-50%) scale(1) rotate(0)} }
        @keyframes celebBounceOut { 0%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(.8)} }
        @keyframes celebFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes confettiFall   { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
    `;
    document.head.appendChild(s);
}

function showCelebration({ title, subtitle, extra = '', onReset }) {
    injectCelebStyles();
    const colours = ['#52b788', '#e9c46a', '#0077b6', '#e76f51', '#d8ede5'];
    for (let i = 0; i < 65; i++) {
        const p = document.createElement('div');
        p.style.cssText = `position:fixed;top:0;left:${Math.random() * 100}vw;width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;background:${colours[Math.floor(Math.random() * colours.length)]};border-radius:${Math.random() > .5 ? '50%' : '2px'};z-index:10001;pointer-events:none;animation:confettiFall ${1.5 + Math.random() * 2}s ${Math.random() * .8}s ease-in forwards;`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 4000);
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;backdrop-filter:blur(3px);';
    const card = document.createElement('div');
    card.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface2);border:2px solid var(--accent2);border-radius:16px;padding:36px 40px;text-align:center;z-index:10002;min-width:280px;max-width:90vw;box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 0 1px rgba(82,183,136,.2);animation:celebBounceIn .55s cubic-bezier(.34,1.56,.64,1) forwards;`;
    card.innerHTML = `
        <div style="font-size:52px;margin-bottom:12px;animation:celebFloat 1.8s ease-in-out infinite;">🎉</div>
        <div style="font-family:'Merriweather',serif;font-size:22px;font-weight:700;color:var(--accent2);margin-bottom:8px;">${title}</div>
        <div style="font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text-dim);margin-bottom:${extra ? '6px' : '22px'};line-height:1.6;">${subtitle}</div>
        ${extra ? `<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--mid);margin-bottom:22px;">${extra}</div>` : ''}
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button id="sharedCelebDismiss" style="background:var(--accent);color:var(--text);border:none;border-radius:8px;padding:10px 22px;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.06em;">✓ Done</button>
            <button id="sharedCelebReset" style="background:transparent;color:var(--text-dim);border:1.5px solid var(--border);border-radius:8px;padding:10px 22px;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.06em;">🔄 Try Again</button>
        </div>`;
    document.body.appendChild(overlay);
    document.body.appendChild(card);
    const dismiss = () => {
        card.style.animation = 'celebBounceOut .3s ease forwards';
        overlay.style.transition = 'opacity .3s'; overlay.style.opacity = '0';
        setTimeout(() => { card.remove(); overlay.remove(); }, 320);
    };
    document.getElementById('sharedCelebDismiss').addEventListener('click', dismiss);
    document.getElementById('sharedCelebReset').addEventListener('click', () => { dismiss(); if (onReset) setTimeout(onReset, 340); });
    overlay.addEventListener('click', dismiss);
}

// ══════════════════════════════════════
// SHARED PROGRESS BAR HELPERS
// ══════════════════════════════════════
// ── Progress bar styles (injected once)
function injectProgressStyles() {
    if (document.getElementById('progressBarStyles')) return;
    const s = document.createElement('style');
    s.id = 'progressBarStyles';
    s.textContent = `
        .prog-inline {
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 14px 20px;
            margin-bottom: 16px;
        }
        .prog-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .prog-label {
            font-family: 'DM Mono', monospace;
            font-size: 10px;
            color: var(--mid);
            letter-spacing: .08em;
            text-transform: uppercase;
        }
        .prog-count {
            font-family: 'DM Mono', monospace;
            font-size: 10px;
            color: var(--mid);
        }
        .prog-track {
            background: var(--border);
            border-radius: 99px;
            height: 10px;
            overflow: hidden;
        }
        .prog-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, var(--accent), var(--accent2), var(--gold));
            border-radius: 99px;
            transition: width .45s cubic-bezier(.4,0,.2,1);
        }
        .prog-float {
            position: fixed;
            top: 52px;
            left: 50%;
            transform: translateX(-50%) translateY(-12px);
            z-index: 200;
            opacity: 0;
            pointer-events: none;
            transition: opacity .3s ease, transform .3s cubic-bezier(.34,1.3,.64,1);
            background: var(--surface);
            border: 1px solid var(--border);
            border-bottom: 2px solid var(--accent2);
            border-radius: 0 0 12px 12px;
            padding: 7px 18px 9px;
            min-width: 200px;
            max-width: min(440px, 88vw);
            width: max-content;
            box-shadow: 0 6px 24px rgba(0,0,0,.45);
            backdrop-filter: blur(6px);
        }
        .prog-float.visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
            pointer-events: auto;
        }
        .prog-float .prog-row { margin-bottom: 4px; }
        .prog-float .prog-label { font-size: 9px; }
        .prog-float .prog-count { font-size: 9px; }
        .prog-float .prog-track { height: 5px; }
        @keyframes progPulse {
            0%   { box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 0 0 rgba(82,183,136,.5); }
            70%  { box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 0 7px rgba(82,183,136,0); }
            100% { box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 0 0 rgba(82,183,136,0); }
        }
        .prog-float.pulse { animation: progPulse .5s ease; }
    `;
    document.head.appendChild(s);
}

// Registry of all active progress bar IDs — used by the scroll handler
const _progIds = [];

function createProgressBar(id, label) {
    injectProgressStyles();

    // Inline bar
    const wrap = document.createElement('div');
    wrap.id = id + 'BarWrap';
    wrap.className = 'prog-inline';
    wrap.innerHTML = `
        <div class="prog-row">
            <span class="prog-label">${label}</span>
            <span class="prog-count" id="${id}BarLabel">0 / 0</span>
        </div>
        <div class="prog-track">
            <div class="prog-fill" id="${id}Bar"></div>
        </div>`;

    // Floating twin
    const floater = document.createElement('div');
    floater.id = id + 'BarFloat';
    floater.className = 'prog-float';
    floater.innerHTML = `
        <div class="prog-row">
            <span class="prog-label">${label}</span>
            <span class="prog-count" id="${id}BarLabelFloat">0 / 0</span>
        </div>
        <div class="prog-track">
            <div class="prog-fill" id="${id}BarFloatFill"></div>
        </div>`;
    document.body.appendChild(floater);

    if (!_progIds.includes(id)) _progIds.push(id);
    return wrap;
}

// Single scroll listener — checks every registered bar on scroll
function _onProgScroll() {
    _progIds.forEach(id => {
        const inlineEl = document.getElementById(id + 'BarWrap');
        const floatEl = document.getElementById(id + 'BarFloat');
        if (!inlineEl || !floatEl) return;

        // Only show if the tab containing this bar is currently active
        const tabPanel = inlineEl.closest('.tab-panel');
        const tabActive = tabPanel && tabPanel.classList.contains('active');
        if (!tabActive) {
            floatEl.classList.remove('visible');
            return;
        }

        const rect = inlineEl.getBoundingClientRect();
        // Show when the bottom of the inline bar has scrolled above the tab bar (~52px)
        floatEl.classList.toggle('visible', rect.bottom < 56);
    });
}
window.addEventListener('scroll', _onProgScroll, { passive: true });

function updateProgressBar(id, done, total) {
    const pct = total ? (done / total * 100) + '%' : '0%';

    // Update inline
    const bar = document.getElementById(id + 'Bar');
    const lbl = document.getElementById(id + 'BarLabel');
    if (bar) bar.style.width = pct;
    if (lbl) lbl.textContent = `${done} / ${total}`;

    // Update float
    const barF = document.getElementById(id + 'BarFloatFill');
    const lblF = document.getElementById(id + 'BarLabelFloat');
    if (barF) barF.style.width = pct;
    if (lblF) lblF.textContent = `${done} / ${total}`;

    // Pulse the floater when an answer is given and it's visible
    const floatEl = document.getElementById(id + 'BarFloat');
    if (floatEl && done > 0 && floatEl.classList.contains('visible')) {
        floatEl.classList.remove('pulse');
        void floatEl.offsetWidth;
        floatEl.classList.add('pulse');
    }

    // Re-evaluate visibility immediately after an answer (no need to scroll)
    _onProgScroll();
}

function destroyProgressBar(id) {
    const floatEl = document.getElementById(id + 'BarFloat');
    if (floatEl) floatEl.remove();
    const i = _progIds.indexOf(id);
    if (i > -1) _progIds.splice(i, 1);
}


// ══════════════════════════════════════
// FILL IN THE BLANKS
// ══════════════════════════════════════
let fibScore = 0, fibCorrectTotal = 0;
let isAdvancedFIB = false;
function isAnswerAcceptable(u, a) {
    u = u.trim().toLowerCase(); a = a.trim().toLowerCase();
    return u === a || u + 's' === a || u === a + 's';
}

function injectFIBProgressBar() {
    if (document.getElementById('fibBarWrap')) return;
    const wrap = document.getElementById('fibWrap');
    if (!wrap) return;
    const bar = createProgressBar('fib', '✏️ Fill in the Blanks — Progress ');
    wrap.parentElement.insertBefore(bar, wrap);
}

function updateFIBProgress() {
    updateProgressBar('fib', fibScore, fibCorrectTotal);
    if (fibScore > 0 && fibScore >= fibCorrectTotal) {
        setTimeout(() => showCelebration({
            title: 'All Blanks Filled!',
            subtitle: 'You completed every gap — great recall! 📝',
            extra: `${fibCorrectTotal} blank${fibCorrectTotal !== 1 ? 's' : ''} answered correctly`,
            onReset: resetFIB
        }), 400);
    }
}

function buildFIB() {
    const wrap = document.getElementById('fibWrap');
    if (!wrap) return;
    fibCorrectTotal = fibData.reduce((a, f) => a + Object.keys(f.blanks).filter(k => f.blanks[k] !== '').length, 0);
    document.getElementById('fibTotal').textContent = fibCorrectTotal;
    fibData.forEach((f, fi) => {
        const div = document.createElement('div');
        div.className = 'fib-sentence';
        let html = f.display, bi = 0;
        if (!isAdvancedFIB) {
            const correctAnswers = Object.values(f.blanks).filter(v => v !== '');
            const distractors = fibWords.filter(w => !correctAnswers.includes(w)).sort(() => Math.random() - .5).slice(0, 4);
            html = html.replace(/_____/g, () => {
                const key = Object.keys(f.blanks)[bi];
                const ans = f.blanks[key]; bi++;
                if (!ans) return `<em>(see above)</em>`;
                const opts = [ans, ...distractors.filter(d => d !== ans).slice(0, 3)].sort(() => Math.random() - .5);
                const optHTML = ['— choose —', ...opts].map(o => `<option value="${o === '— choose —' ? '' : o}">${o}</option>`).join('');
                return `<span class="blank-select" data-fi="${fi}" data-key="${key}" data-ans="${ans}"><select>${optHTML}</select></span>`;
            });
            div.innerHTML = html;
        } else {
            html = html.replace(/_____/g, () => {
                const key = Object.keys(f.blanks)[bi];
                const ans = f.blanks[key]; bi++;
                if (!ans) return `<em>(see above)</em>`;
                return `<input type="text" class="fib-input" data-fi="${fi}" data-key="${key}" data-ans="${ans}" placeholder="type here...">`;
            });
            div.innerHTML = html;
            const checkBtn = document.createElement('button');
            checkBtn.className = 'fib-check-btn'; checkBtn.innerHTML = '✓ Check Answers';
            checkBtn.addEventListener('click', () => {
                const inputs = div.querySelectorAll('.fib-input');
                let allOk = true;
                inputs.forEach(input => {
                    if (input.disabled) return;
                    if (isAnswerAcceptable(input.value, input.dataset.ans)) {
                        input.classList.remove('wrong'); input.classList.add('correct');
                        input.disabled = true; fibScore++;
                    } else { input.classList.remove('correct'); input.classList.add('wrong'); allOk = false; }
                });
                document.getElementById('fibScore').textContent = fibScore;
                if (allOk) { checkBtn.innerHTML = 'Perfect! ✨'; checkBtn.disabled = true; }
                updateFIBProgress();
            });
            div.appendChild(document.createElement('br'));
            div.appendChild(checkBtn);
        }
        wrap.appendChild(div);
    });
    if (!isAdvancedFIB && !wrap.dataset.listenerAttached) {
        wrap.addEventListener('change', e => {
            const sel = e.target; if (sel.tagName !== 'SELECT') return;
            const wrapper = sel.closest('.blank-select'); if (!wrapper || wrapper.dataset.answered === 'correct') return;
            const chosen = sel.value, ans = wrapper.dataset.ans; if (!chosen) return;
            if (chosen === ans) {
                wrapper.dataset.answered = 'correct'; wrapper.classList.remove('wrong'); wrapper.classList.add('correct');
                sel.disabled = true; fibScore++;
                document.getElementById('fibScore').textContent = fibScore;
                updateFIBProgress();
            } else {
                wrapper.classList.remove('correct'); wrapper.classList.add('wrong');
                setTimeout(() => { wrapper.classList.remove('wrong'); sel.value = ''; }, 700);
            }
        });
        wrap.dataset.listenerAttached = 'true';
    }
    injectFIBProgressBar();
    updateProgressBar('fib', 0, fibCorrectTotal);
}
function resetFIB() {
    fibScore = 0;
    document.getElementById('fibScore').textContent = 0;
    document.getElementById('fibWrap').innerHTML = '';
    destroyProgressBar('fib');
    const old = document.getElementById('fibBarWrap');
    if (old) old.remove();
    buildFIB();
}
function injectFIBAdvancedToggle() {
    const fibScoreEl = document.getElementById('fibScore');
    const scoreBar = fibScoreEl ? fibScoreEl.closest('.score-bar') : null;
    if (!scoreBar || scoreBar.querySelector('.fib-mode-toggle')) return;
    const btn = document.createElement('button');
    btn.className = 'fc-btn outline fib-mode-toggle';
    btn.innerHTML = '🔥 Advanced Mode: Typing';
    btn.addEventListener('click', () => {
        isAdvancedFIB = !isAdvancedFIB;
        btn.innerHTML = isAdvancedFIB ? '🔽 Standard Mode: Dropdowns' : '🔥 Advanced Mode: Typing';
        resetFIB();
    });
    scoreBar.appendChild(btn);
}

// ══════════════════════════════════════
// FLASHCARDS
// ══════════════════════════════════════
let activeDeck = [], fcIndex = 0, knownCards = [], unknownCards = [];

function injectFCProgressBar() {
    if (document.getElementById('fcBarWrap')) return;
    const scoreBar = document.getElementById('fcScoreBar');
    if (!scoreBar) return;
    const bar = createProgressBar('fc', '🃏 Flashcards — Progress ');
    scoreBar.after(bar);
}

function updateFCProgress() {
    const done = knownCards.length + unknownCards.length;
    updateProgressBar('fc', done, activeDeck.length + done);
}

function initFlashcards() {
    if (!document.getElementById('fcTerm') || typeof flashcards === 'undefined') return;
    activeDeck = [...flashcards];
    injectFCProgressBar();
    resetFlashcardsState();
}
function resetFlashcardsState() {
    fcIndex = 0; knownCards = []; unknownCards = [];
    document.getElementById('fcSummaryArea').style.display = 'none';
    document.getElementById('fcActiveArea').style.display = 'block';
    document.getElementById('fcScoreBar').style.display = 'flex';
    updateProgressBar('fc', 0, activeDeck.length);
    renderFC(); updateFCScore();
}
function resetFlashcards() { activeDeck = [...flashcards]; updateProgressBar("fc", 0, activeDeck.length); resetFlashcardsState(); }
function reviewWrong() { if (unknownCards.length === 0) return; activeDeck = [...unknownCards]; resetFlashcardsState(); }
function renderFC() {
    const termEl = document.getElementById('fcTerm');
    if (!termEl || activeDeck.length === 0) return;
    const fc = activeDeck[fcIndex];
    termEl.textContent = fc.term;
    document.getElementById('fcDef').textContent = fc.def;
    document.getElementById('fcProgress').textContent = `Card ${fcIndex + 1} of ${activeDeck.length}`;
    document.getElementById('flashcard').classList.remove('flipped');
    document.getElementById('fcNavDefault').style.display = 'flex';
    document.getElementById('fcNavAssess').style.display = 'none';
}
function flipCard() {
    const cardEl = document.getElementById('flashcard');
    if (!cardEl) return;
    cardEl.classList.toggle('flipped');
    const isFlipped = cardEl.classList.contains('flipped');
    document.getElementById('fcNavDefault').style.display = isFlipped ? 'none' : 'flex';
    document.getElementById('fcNavAssess').style.display = isFlipped ? 'flex' : 'none';
}
function markCard(isKnown) {
    if (isKnown) knownCards.push(activeDeck[fcIndex]); else unknownCards.push(activeDeck[fcIndex]);
    updateFCScore();
    updateFCProgress();
    if (fcIndex < activeDeck.length - 1) {
        fcIndex++; renderFC();
    } else {
        showFCSummary();
        const perfect = unknownCards.length === 0;
        setTimeout(() => showCelebration({
            title: perfect ? 'Perfect Deck!' : 'Deck Complete!',
            subtitle: perfect
                ? 'You knew every card — outstanding! 🌟'
                : `${knownCards.length} known, ${unknownCards.length} to review`,
            extra: `${activeDeck.length} card${activeDeck.length !== 1 ? 's' : ''} completed`,
            onReset: resetFlashcards
        }), 400);
    }
}
function updateFCScore() {
    const knownEl = document.getElementById('fcKnown');
    if (!knownEl) return;
    knownEl.textContent = knownCards.length;
    document.getElementById('fcUnknown').textContent = unknownCards.length;
    document.getElementById('fcTotalTrack').textContent = activeDeck.length;
}
function showFCSummary() {
    document.getElementById('fcActiveArea').style.display = 'none';
    document.getElementById('fcSummaryArea').style.display = 'block';
    document.getElementById('fcSummaryKnown').textContent = knownCards.length;
    document.getElementById('fcSummaryTotal').textContent = activeDeck.length;
    document.getElementById('btnReviewWrong').style.display = unknownCards.length > 0 ? 'inline-block' : 'none';
}
function nextCard() { if (!activeDeck.length) return; fcIndex = (fcIndex + 1) % activeDeck.length; renderFC(); }
function prevCard() { if (!activeDeck.length) return; fcIndex = (fcIndex - 1 + activeDeck.length) % activeDeck.length; renderFC(); }

// ══════════════════════════════════════
// TRUE / FALSE
// ══════════════════════════════════════
let tfScore = 0, tfTotal = 0;

function injectTFProgressBar() {
    if (document.getElementById('tfBarWrap')) return;
    const wrap = document.getElementById('tfWrap');
    if (!wrap) return;
    const bar = createProgressBar('tf', '✅ True / False — Progress ');
    wrap.parentElement.insertBefore(bar, wrap);
}

function updateTFProgress() {
    updateProgressBar('tf', tfTotal, tfData.length);
    if (tfTotal > 0 && tfTotal >= tfData.length) {
        const perfect = tfScore === tfData.length;
        setTimeout(() => showCelebration({
            title: perfect ? 'Full Marks!' : 'All Done!',
            subtitle: perfect
                ? 'Every statement answered correctly — brilliant! 🎯'
                : `You scored ${tfScore} out of ${tfData.length}`,
            extra: `${tfData.length} statement${tfData.length !== 1 ? 's' : ''} completed`,
            onReset: resetTF
        }), 400);
    }
}

function buildTF() {
    const wrap = document.getElementById('tfWrap');
    if (!wrap) return;
    tfData.forEach((item, i) => {
        const card = document.createElement('div'); card.className = 'tf-card';
        card.innerHTML = `<div><div class="tf-text">${item.statement}</div><div class="tf-explanation" id="tfExp-${i}">${item.explanation}</div></div>
<div class="tf-btns"><button class="tf-btn" data-i="${i}" data-val="true">TRUE</button><button class="tf-btn" data-i="${i}" data-val="false">FALSE</button></div>`;
        wrap.appendChild(card);
    });
    wrap.addEventListener('click', e => {
        const btn = e.target.closest('.tf-btn'); if (!btn) return;
        const i = +btn.dataset.i; const card = btn.closest('.tf-card');
        if (card.dataset.answered) return;
        card.dataset.answered = 1;
        const val = btn.dataset.val === 'true'; const correct = val === tfData[i].answer; tfTotal++;
        card.querySelectorAll('.tf-btn').forEach(b => b.disabled = true);
        if (correct) { btn.classList.add('correct'); tfScore++; }
        else { btn.classList.add('wrong'); card.querySelectorAll('.tf-btn').forEach(b => { if (b.dataset.val === String(tfData[i].answer)) b.classList.add('correct'); }); }
        document.getElementById(`tfExp-${i}`).classList.add('show');
        document.getElementById('tfScore').textContent = tfScore;
        document.getElementById('tfTotal').textContent = tfTotal;
        updateTFProgress();
    });
    injectTFProgressBar();
    updateProgressBar('tf ', 0, tfData.length);
}
function resetTF() {
    tfScore = 0; tfTotal = 0;
    document.getElementById('tfScore').textContent = 0;
    document.getElementById('tfTotal').textContent = 0;
    document.getElementById('tfWrap').innerHTML = '';
    destroyProgressBar('tf');
    const old = document.getElementById('tfBarWrap');
    if (old) old.remove();
    buildTF();
}

// ══════════════════════════════════════
// EXAM PRACTICE
// ══════════════════════════════════════
let epRevealed = 0;

function injectEPProgressBar() {
    if (document.getElementById('epBarWrap')) return;
    const list = document.getElementById('epList');
    if (!list) return;
    const bar = createProgressBar('ep', '📝 Exam Practice — Questions Attempted');
    list.parentElement.insertBefore(bar, list);
}

function updateEPProgress() {
    updateProgressBar('ep', epRevealed, examQuestions.length);
    if (epRevealed > 0 && epRevealed >= examQuestions.length) {
        setTimeout(() => showCelebration({
            title: 'Practice Complete!',
            subtitle: 'You worked through every exam question — well done! 📋',
            extra: `${examQuestions.length} question${examQuestions.length !== 1 ? 's' : ''} attempted`,
            onReset: () => {
                epRevealed = 0;
                document.getElementById('epList').innerHTML = '';
                destroyProgressBar('ep');
                const old = document.getElementById('epBarWrap');
                if (old) old.remove();
                buildExamPractice();
            }
        }), 400);
    }
}
function buildMisc() {
    const list = document.getElementById('miscList');
    if (!list) return;
    miscData.forEach(m => {
        const card = document.createElement('div'); card.className = 'misc-card';
        card.innerHTML = `<div class="wrong-view"><div class="misc-tag">✗ Common Student View</div><p>${m.wrong}</p></div><div class="correct-view"><div class="misc-tag">✓ Examiner's Correct View</div><p>${m.correct}</p></div>`;
        list.appendChild(card);
    });
}

// ── BUILD EXAM TIPS ──
function buildTips() {
    const grid = document.getElementById('tipsGrid');
    if (!grid) return;
    examTips.forEach(t => {
        const card = document.createElement('div'); card.className = 'tip-card'; card.style.cursor = 'pointer';
        const pills = t.pills.map(p => `<span class="mark-pill ${p}">${p}</span>`).join('');
        card.innerHTML = `<span class="toggle-icon" style="position:absolute;right:20px;top:20px;color:#5a6e7f;font-size:18px;transition:transform 0.3s;">+</span>
<div class="tip-type">${t.type}</div><h4>${t.title}</h4>
<div class="tip-content">${t.content}${t.pills.length ? `<div class="mark-breakdown">${pills}</div>` : ''}</div>`;
        card.addEventListener('dblclick', () => { card.classList.toggle('open'); window.getSelection().removeAllRanges(); });
        grid.appendChild(card);
    });
    injectExpandAll('tab-examtips', 'tipsGrid', 'tip-card');
}


// ── BUILD EXAM PRACTICE ──
function buildExamPractice() {
    const list = document.getElementById('epList');
    if (!list) return;
    examQuestions.forEach((q, qi) => {
        const card = document.createElement('div'); card.className = 'ep-card';
        const caseHtml = q.caseStudy ? `<div class="ep-case">${q.caseStudy.replace(/\n/g, '<br>')}</div>` : '';
        let interactiveHtml = '';
        if (q.type === 'mcq') {
            interactiveHtml = `<div class="ep-mcq-opts">${q.options.map((o, oi) => `<button class="ep-opt" data-qi="${qi}" data-oi="${oi}"><strong>${String.fromCharCode(65 + oi)}.</strong> ${o}</button>`).join('')}</div>`;
        } else {
            interactiveHtml = `<textarea class="ep-answer-area" id="epTextarea-${qi}" placeholder="Write your answer here..."></textarea>`;
        }
        card.innerHTML = `<div class="ep-header">
<div><div class="ep-num">${q.num}</div><div class="ep-title">${q.marks} mark${q.marks > 1 ? 's' : ''}</div></div>
<div class="ep-marks">[${q.marks} mark${q.marks > 1 ? 's' : ''}]</div>
</div>
<div class="ep-body">
${caseHtml}
<div class="ep-question">${q.question.replace(/\n/g, '<br>')}</div>
${interactiveHtml}
<div class="ep-btn-row">
<button class="ep-btn hint-btn" onclick="togglePop(${qi},'hint')">💡 Hint</button>
<button class="ep-btn starter-btn" onclick="togglePop(${qi},'starter')">✍️ Sentence Starter</button>
${q.type !== 'mcq' ? `<button class="ep-btn submit-btn" onclick="togglePop(${qi},'marks')">📋 Submit &amp; See Mark Scheme</button>` : ''}
</div>
<div class="ep-popup hint-pop" id="epHint-${qi}"><strong>💡 Hint:</strong> ${q.hint}</div>
<div class="ep-popup starter-pop" id="epStarter-${qi}"><strong>✍️ Sentence Starter:</strong><br>${q.starter.replace(/\n/g, '<br>')}</div>
<div class="ep-popup marks-pop" id="epMarks-${qi}">
${q.markScheme}
${q.modelAnswer ? `<div class="marks-section"><h5>✓ Model Answer</h5><div class="model-answer">${q.modelAnswer.replace(/\n/g, '<br>')}</div></div>` : ''}
</div>
</div>`;
        list.appendChild(card);
    });
    // MCQ auto-reveal on click
    list.addEventListener('click', e => {
        const btn = e.target.closest('.ep-opt'); if (!btn) return;
        const qi = +btn.dataset.qi, oi = +btn.dataset.oi;
        const card = btn.closest('.ep-card');
        if (card.dataset.epAnswered) return;
        card.dataset.epAnswered = 1;
        const allOpts = card.querySelectorAll('.ep-opt');
        allOpts.forEach(b => b.disabled = true);
        btn.classList.add(oi === examQuestions[qi].answer ? 'ep-correct' : 'ep-wrong');
        if (oi !== examQuestions[qi].answer) allOpts[examQuestions[qi].answer].classList.add('ep-correct');
        document.getElementById(`epMarks-${qi}`).classList.add('show');
        epRevealed++; updateEPProgress();
    });
    injectEPProgressBar();
    updateProgressBar('ep', 0, examQuestions.length);
}
function togglePop(qi, type) {
    const hint = document.getElementById(`epHint-${qi}`);
    const starter = document.getElementById(`epStarter-${qi}`);
    const marks = document.getElementById(`epMarks-${qi}`);
    if (type === 'hint') { hint.classList.toggle('show'); starter.classList.remove('show'); }
    else if (type === 'starter') { starter.classList.toggle('show'); hint.classList.remove('show'); }
    else if (type === 'marks') {
        const wasHidden = !marks.classList.contains('show');
        marks.classList.toggle('show');
        // Count as attempted the first time the mark scheme is revealed
        const card = marks.closest('.ep-card');
        if (wasHidden && !card.dataset.epRevealed) {
            card.dataset.epRevealed = 1;
            epRevealed++; updateEPProgress();
        }
    }
}

// ── SCROLL TO TOP ──
function initScrollToTop() {
    const btn = document.createElement('button');
    btn.innerHTML = '↑ Top'; btn.className = 'scroll-to-top';
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 300));
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── TOAST ──
let toastEl = null, toastTimeout = null;
function showDoubleClickHint() {
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'toast-hint';
        toastEl.innerHTML = `💡 <strong>Hint:</strong> Double-tap to open or close details.`;
        document.body.appendChild(toastEl);
    }
    toastEl.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// ── RANDOMISE BUTTONS ──
function injectRandomiseButtons() {
    document.querySelectorAll('.reset-btn').forEach(resetBtn => {
        if (resetBtn.previousElementSibling && resetBtn.previousElementSibling.classList.contains('random-btn')) return;
        const oc = resetBtn.getAttribute('onclick') || '';
        let logic = null;
        if (oc.includes('resetMCQ')) logic = () => { mcqData.sort(() => Math.random() - .5); resetMCQ(); };
        else if (oc.includes('resetMatch')) logic = () => { matchData.sort(() => Math.random() - .5); resetMatch(); };
        else if (oc.includes('resetFIB')) logic = () => { fibData.sort(() => Math.random() - .5); resetFIB(); };
        else if (oc.includes('resetFlash')) logic = () => { flashcards.sort(() => Math.random() - .5); resetFlashcards(); };
        else if (oc.includes('resetTF')) logic = () => { tfData.sort(() => Math.random() - .5); resetTF(); };
        if (logic) {
            const rndBtn = document.createElement('button');
            rndBtn.className = 'reset-btn random-btn'; rndBtn.innerHTML = '🔀 RANDOMISE';
            rndBtn.style.marginLeft = 'auto'; resetBtn.style.marginLeft = '0';
            rndBtn.addEventListener('click', logic);
            resetBtn.parentNode.insertBefore(rndBtn, resetBtn);
        }
    });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    buildLearn();
    buildMCQ();
    buildMatch();
    buildFIB();
    buildMisc();
    buildTips();
    initFlashcards();
    buildTF();
    buildExamPractice();
    initScrollToTop();
    injectRandomiseButtons();
    injectFIBAdvancedToggle();
    setTimeout(showDoubleClickHint, 800);
});

document.addEventListener('DOMContentLoaded', () => {
    const badgeEl = document.querySelector('.badge');
    const h1El = document.querySelector('header h1');
    const subEl = document.querySelector('header p');
    const titleEl = document.querySelector('title');

    if (badgeEl) badgeEl.innerHTML = pageMeta.badge;
    if (h1El) h1El.textContent = pageMeta.title;
    if (subEl) subEl.textContent = pageMeta.subtitle;
    if (titleEl) titleEl.textContent = pageMeta.title.replace(/&amp;/g, '&');
});