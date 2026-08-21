const firebaseConfig = {
  databaseURL: "https://tpocket-b3eb6-default-rtdb.firebaseio.com/"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let currentShioriId = 'guam-2026';
let currentDayIdx = 0;
let localShioris = [];
let showAllScheduleModal = false;

// フリック検知用変数
let touchStartX = 0;
let touchEndX = 0;

db.ref('shioris').on('value', (snapshot) => {
  const data = snapshot.val();
  if (data) {
    localShioris = Object.keys(data).map(key => ({ id: key, ...data[key] }));
  } else {
    const initialData = {
      'guam-2026': {
        title: 'グアム3泊4日 🌴 Beach & BBQ',
        destination: 'グアム',
        startDate: '2026-09-10',
        headerImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        days: [
          {
            dayNum: 1, dateStr: '2026-09-10', title: 'Day 1',
            spots: [
              { id: 's1', time: '10:00', title: 'グアム国際空港 到着', memo: '入国審査書類を確認！', isAfter: false, beforeImg: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=600&q=80', reserveLink: 'https://www.guamairport.com/' },
              { id: 's2', time: '12:30', title: 'グアムリーフホテル Reef BBQ', memo: 'オーシャンビュー席でランチ', isAfter: true, beforeImg: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80', reserveLink: 'https://guamreef.com' }
            ]
          },
          { dayNum: 2, dateStr: '2026-09-11', title: 'Day 2', spots: [] },
          { dayNum: 3, dateStr: '2026-09-12', title: 'Day 3', spots: [] }
        ]
      }
    };
    db.ref('shioris').set(initialData);
  }
  renderApp();
});

function saveToCloud(shioriId, shioriData) {
  db.ref('shioris/' + shioriId).set(shioriData);
}

function renderApp() {
  const container = document.getElementById('app');
  const shiori = localShioris.find(s => s.id === currentShioriId) || (localShioris[0] || null);
  
  if (!shiori) {
    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">読み込み中...</div>';
    return;
  }

  const currentDay = (shiori.days && shiori.days[currentDayIdx]) ? shiori.days[currentDayIdx] : { spots: [] };

  container.innerHTML = `
    <!-- 1画面完結 メインビュー -->
    <div class="relative bg-slate-50 min-h-screen flex flex-col" id="swipe-zone">
      
      <!-- ヘッダー -->
      <div class="sticky top-0 z-30 bg-slate-900 text-white p-3 px-4 flex items-center justify-between shadow-md">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-plane-departure text-blue-400"></i>
          <span class="text-xs font-black tracking-wide">${shiori.title}</span>
        </div>
        <button onclick="showAllScheduleModal = true; renderApp();" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow">
          <i class="fa-solid fa-table-list"></i> 予定一覧表示
        </button>
      </div>

      <!-- カレンダー & 日程追加バー -->
      <div class="bg-white p-3 border-b shadow-sm space-y-2">
        <div class="flex items-center justify-between text-xs font-bold text-slate-600">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <i class="fa-regular fa-calendar-days text-blue-600 text-sm"></i>
            <span>旅行開始日:</span>
            <input type="date" value="${shiori.startDate || '2026-09-10'}" onchange="updateStartDate('${shiori.id}', this.value)" class="bg-slate-100 border rounded px-2 py-0.5 text-xs font-bold text-slate-800">
          </label>
          <button onclick="addDay('${shiori.id}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold border">+ Day追加</button>
        </div>

        <!-- Day タブ (左右スクロール可) -->
        <div class="flex gap-2 overflow-x-auto hide-scrollbar pt-1">
          ${(shiori.days || []).map((d, idx) => `
            <button onclick="currentDayIdx = ${idx}; renderApp();" class="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${currentDayIdx === idx ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
              Day ${d.dayNum} <span class="text-[10px] opacity-80">(${formatShortDate(shiori.startDate, idx)})</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- タイムライン / フリック可能領域 -->
      <div class="p-4 flex-1 space-y-4 pb-32">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-slate-500 uppercase tracking-wider">Day ${currentDay.dayNum} スケジュール</span>
          <span class="text-[10px] text-slate-400">👈 左右フリックでDay移動 👉</span>
        </div>

        ${(!currentDay.spots || currentDay.spots.length === 0) ? `
          <div class="text-center py-12 bg-white rounded-2xl border border-dashed p-6 text-xs text-slate-400">
            この日の予定はありません。<br>下の入力フォームから直接追加できます。
          </div>
        ` : currentDay.spots.map((spot, sIdx) => `
          <div class="bg-white rounded-2xl p-3.5 border shadow-sm space-y-2 relative">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg"><i class="fa-regular fa-clock mr-1"></i>${spot.time}</span>
              <button onclick="deleteSpot('${shiori.id}', ${currentDayIdx}, ${sIdx})" class="text-slate-300 hover:text-red-500 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
            </div>
            <h3 class="font-bold text-slate-800 text-sm">${spot.title}</h3>
            ${spot.memo ? `<p class="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">${spot.memo}</p>` : ''}
            ${spot.reserveLink ? `
              <a href="${spot.reserveLink}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                <i class="fa-solid fa-link"></i> Webリンク <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </a>
            ` : ''}
          </div>
        `).join('')}

        <!-- 1画面完結 インライン予定作成フォーム -->
        <div class="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-3 mt-6 shadow-inner">
          <h4 class="text-xs font-bold text-blue-900 flex items-center gap-1.5"><i class="fa-solid fa-plus-circle text-blue-600"></i> 新しい予定をここに追加</h4>
          
          <div class="flex items-center gap-2">
            <!-- 時間選択ドラムロール風UI -->
            <div class="flex items-center gap-1 bg-white px-2 py-1 border rounded-lg shadow-sm">
              <i class="fa-regular fa-clock text-slate-400 text-xs"></i>
              <select id="input-hour" class="time-picker-select">
                ${Array.from({length:24}).map((_,h) => `<option value="${String(h).padStart(2,'0')}">${String(h).padStart(2,'0')}</option>`).join('')}
              </select>
              <span class="font-bold text-slate-400">:</span>
              <select id="input-minute" class="time-picker-select">
                ${['00','15','30','45'].map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>
            <input type="text" id="input-title" placeholder="予定・スポット名" class="flex-1 border text-xs rounded-lg p-2.5 font-medium outline-none focus:border-blue-500">
          </div>

          <input type="text" id="input-memo" placeholder="メモ（任意）" class="w-full border text-xs rounded-lg p-2 font-medium outline-none">
          <input type="text" id="input-link" placeholder="WebリンクURL（任意）" class="w-full border text-xs rounded-lg p-2 font-medium outline-none">

          <button onclick="addSpotInline('${shiori.id}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all">
            この内容で追加する
          </button>
        </div>
      </div>
    </div>

    <!-- 全スケジュール横スクロール一覧表示 モーダル -->
    ${showAllScheduleModal ? renderAllScheduleModal(shiori) : ''}
  `;

  // フリックイベントの設定
  setupSwipeEvents(shiori);
}

function renderAllScheduleModal(shiori) {
  return `
    <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
      <div class="bg-white rounded-t-3xl max-h-[90vh] flex flex-col h-full overflow-hidden">
        
        <div class="p-4 border-b flex items-center justify-between bg-slate-900 text-white">
          <div>
            <h3 class="font-bold text-sm">全スケジュール一覧</h3>
            <p class="text-[10px] text-slate-400">横にスクロールして全日程を俯瞰できます</p>
          </div>
          <button onclick="showAllScheduleModal = false; renderApp();" class="text-slate-400 hover:text-white p-2 text-lg"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <!-- 横スクロールコンテナ -->
        <div class="p-4 flex gap-4 overflow-x-auto flex-1 items-start bg-slate-100">
          ${(shiori.days || []).map((day, idx) => `
            <div class="min-w-[260px] max-w-[260px] bg-white rounded-2xl p-4 border shadow-md flex-shrink-0 space-y-3 max-h-full overflow-y-auto">
              <div class="flex items-center justify-between border-b pb-2 sticky top-0 bg-white z-10">
                <span class="font-black text-blue-600 text-sm">Day ${day.dayNum}</span>
                <span class="text-xs font-bold text-slate-400">${formatShortDate(shiori.startDate, idx)}</span>
              </div>

              <div class="space-y-2.5">
                ${(!day.spots || day.spots.length === 0) ? `
                  <div class="text-center py-8 text-xs text-slate-300">予定なし</div>
                ` : day.spots.map(s => `
                  <div class="bg-slate-50 p-2.5 rounded-xl border text-xs space-y-1">
                    <span class="font-bold text-blue-600 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded">${s.time}</span>
                    <div class="font-bold text-slate-800 mt-1">${s.title}</div>
                    ${s.memo ? `<div class="text-[10px] text-slate-500">${s.memo}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// 左右フリック操作の追加
function setupSwipeEvents(shiori) {
  setTimeout(() => {
    const zone = document.getElementById('swipe-zone');
    if (!zone) return;

    zone.ontouchstart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    zone.ontouchend = (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe(shiori);
    };
  }, 50);
}

function handleSwipe(shiori) {
  const swipeThreshold = 50;
  if (touchEndX < touchStartX - swipeThreshold) {
    // 右から左へスワイプ -> 次のDay
    if (currentDayIdx < shiori.days.length - 1) {
      currentDayIdx++;
      renderApp();
    }
  }
  if (touchEndX > touchStartX + swipeThreshold) {
    // 左から右へスワイプ -> 前のDay
    if (currentDayIdx > 0) {
      currentDayIdx--;
      renderApp();
    }
  }
}

function formatShortDate(baseDateStr, offsetDays) {
  if (!baseDateStr) return '';
  const d = new Date(baseDateStr);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function updateStartDate(shioriId, newDateStr) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    shiori.startDate = newDateStr;
    saveToCloud(shioriId, shiori);
  }
}

function addDay(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    if (!shiori.days) shiori.days = [];
    const nextNum = shiori.days.length + 1;
    shiori.days.push({ dayNum: nextNum, title: `Day ${nextNum}`, spots: [] });
    saveToCloud(shioriId, shiori);
  }
}

function addSpotInline(shioriId) {
  const hour = document.getElementById('input-hour').value;
  const minute = document.getElementById('input-minute').value;
  const title = document.getElementById('input-title').value;
  const memo = document.getElementById('input-memo').value;
  const link = document.getElementById('input-link').value;

  if (!title) {
    alert('予定名を入力してください');
    return;
  }

  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    if (!shiori.days[currentDayIdx].spots) shiori.days[currentDayIdx].spots = [];
    shiori.days[currentDayIdx].spots.push({
      id: 'spot-' + Date.now(),
      time: `${hour}:${minute}`,
      title: title,
      memo: memo,
      reserveLink: link
    });
    // 時間順にソート
    shiori.days[currentDayIdx].spots.sort((a,b) => a.time.localeCompare(b.time));
    saveToCloud(shioriId, shiori);
  }
}

function deleteSpot(shioriId, dayIdx, spotIdx) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    shiori.days[dayIdx].spots.splice(spotIdx, 1);
    saveToCloud(shioriId, shiori);
  }
}